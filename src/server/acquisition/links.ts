/**
 * Service layer pra artist signup links — Aquisição CRUD.
 *
 * Cada artist_signup_links row representa um link público
 * (`/r/{slug}`) que um artista compartilha nas redes pra atrair
 * signups. Quando alguém se cadastra através do link, o backend
 * resolve o cookie `fanverse_ref={slug}` na criação do user row
 * e grava `users.signup_link_id` apontando pra essa linha.
 *
 * Funções expostas:
 *   - listArtistLinks   — todos os links com count de signups
 *   - createArtistLink  — cria novo link (slug deve ser único)
 *   - getArtistLinkBySlug — usado por /r/[slug] e pelo signup
 *   - getArtistLinkById — usado no detail page admin
 *   - listUsersForLink  — paginação de users atribuídos
 *   - archiveArtistLink — soft delete (set archivedAt)
 *   - resolveSlugOnSignup — chamado no INSERT do user pra
 *     atribuir signup_link_id se houver cookie válido
 */

import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { artistSignupLinks } from '../db/schema';

export interface ArtistSignupLink {
  id: string;
  slug: string;
  artistName: string;
  label: string | null;
  createdAt: string;
  createdBy: string | null;
  archivedAt: string | null;
}

export interface ArtistSignupLinkWithStats extends ArtistSignupLink {
  /** Quantos users já se cadastraram via este link. */
  signupCount: number;
}

export interface LinkUserRow {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  isOnboarded: boolean;
}

function rowToLink(row: typeof artistSignupLinks.$inferSelect): ArtistSignupLink {
  return {
    id: row.id,
    slug: row.slug,
    artistName: row.artistName,
    label: row.label,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

/**
 * Lista todos os links com count de signups atribuídos. Ordenação
 * por criação desc — os mais novos no topo.
 */
export async function listArtistLinks(): Promise<ArtistSignupLinkWithStats[]> {
  /* HOTFIX: o JOIN agregado com users.signupLinkId foi REMOVIDO
   * porque a coluna `users.signup_link_id` ainda não existe em
   * prod (migração 0035 não rodou). signupCount fica fixado em
   * 0 até a migração ser aplicada. */
  const rows = await db
    .select()
    .from(artistSignupLinks)
    .orderBy(desc(artistSignupLinks.createdAt));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    artistName: r.artistName,
    label: r.label,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    signupCount: 0,
  }));
}

/**
 * Cria um novo link. Valida slug (URL-safe), normaliza pra
 * lowercase + trim, e trava em race conditions via UNIQUE.
 */
export async function createArtistLink(input: {
  slug: string;
  artistName: string;
  label?: string | null;
  createdBy: string;
}): Promise<ArtistSignupLink> {
  const slug = input.slug.trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(slug)) {
    throw new Error('invalid_slug');
  }

  const inserted = await db
    .insert(artistSignupLinks)
    .values({
      slug,
      artistName: input.artistName.trim(),
      label: input.label?.trim() || null,
      createdBy: input.createdBy,
    })
    .returning();

  if (inserted.length === 0) throw new Error('insert_failed');
  return rowToLink(inserted[0]);
}

/**
 * Lookup por slug — usado pelo /r/[slug] (pra validar antes de
 * setar o cookie) e pelo signup (pra resolver o cookie e
 * atribuir signup_link_id).
 *
 * Links arquivados ainda podem ser resolvidos pra atribuição —
 * a regra é "link arquivado NÃO recebe NOVOS signups via /r/X",
 * mas se um signup chegar com cookie de um link arquivado
 * (caso edge), ainda atribuímos pra preservar a auditoria.
 */
export async function getArtistLinkBySlug(
  slug: string,
): Promise<ArtistSignupLink | null> {
  const row = await db
    .select()
    .from(artistSignupLinks)
    .where(eq(artistSignupLinks.slug, slug.toLowerCase()))
    .limit(1);
  if (row.length === 0) return null;
  return rowToLink(row[0]);
}

export async function getArtistLinkById(
  id: string,
): Promise<ArtistSignupLink | null> {
  const row = await db
    .select()
    .from(artistSignupLinks)
    .where(eq(artistSignupLinks.id, id))
    .limit(1);
  if (row.length === 0) return null;
  return rowToLink(row[0]);
}

/**
 * Lista os users atribuídos a um link, paginado. Usado no
 * detail page do admin (/admin/aquisicao/[id]).
 */
export async function listUsersForLink(
  _linkId: string,
  _opts: { limit?: number; offset?: number } = {},
): Promise<{ items: LinkUserRow[]; total: number }> {
  /* HOTFIX: query desabilitada — users.signupLinkId não existe
   * em prod até a migration 0035 ser aplicada. Detail page do
   * /admin/aquisicao/[id] vai mostrar "0 usuários atribuídos"
   * até a coluna ser criada. Restaurar depois da migração. */
  return { items: [], total: 0 };
}

/**
 * Soft-delete — seta archivedAt. Não apaga a row porque os
 * users que vieram desse link mantêm a FK e o histórico é
 * importante pra auditoria de campanhas.
 */
export async function archiveArtistLink(id: string): Promise<void> {
  await db
    .update(artistSignupLinks)
    .set({ archivedAt: new Date() })
    .where(eq(artistSignupLinks.id, id));
}

/**
 * Resolve um slug (vindo do cookie `fanverse_ref` no signup) pro
 * id do link. Retorna null se slug inválido ou inexistente —
 * nesse caso o signup vira "orgânico" (signup_link_id fica null).
 *
 * Chamado de dentro da transação de criação do user row, então
 * deve ser tolerante a falhas: qualquer exception aqui é logada
 * e tratada como "sem atribuição" — não derruba o signup.
 */
export async function resolveSlugForSignup(
  slug: string | null | undefined,
): Promise<string | null> {
  if (!slug) return null;
  try {
    const link = await getArtistLinkBySlug(slug);
    return link?.id ?? null;
  } catch {
    return null;
  }
}
