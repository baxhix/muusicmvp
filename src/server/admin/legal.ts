/**
 * Admin helpers para `legal_documents` — Termos de Uso + Política
 * de Privacidade, POR surface (site / app / platform).
 *
 * Tabela com 6 rows fixas (2 kinds × 3 surfaces) seeded nas
 * migrations 0043 + 0044. Admin nunca cria do zero — só edita e
 * publica cada documento individualmente.
 *
 * Surfaces:
 *   - 'site'      — site público de marketing (linkado em /termos,
 *                   /privacidade e no footer da landing)
 *   - 'app'       — app (modal in-app no drawer do TopBar)
 *   - 'platform'  — plataforma web (artistas, criadores)
 *
 * Operações sempre tomam `(kind, surface)` — não há operação que
 * afete várias surfaces ao mesmo tempo. Isso é proposital: o
 * fluxo "Salvar e publicar" é uma decisão consciente por
 * documento, não em massa.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { legalDocuments } from '../db/schema';

export type LegalDocumentKind = 'terms_of_use' | 'privacy_policy';
export type LegalDocumentSurface = 'site' | 'app' | 'platform';

export const LEGAL_DOCUMENT_KINDS: readonly LegalDocumentKind[] = [
  'terms_of_use',
  'privacy_policy',
] as const;

export const LEGAL_DOCUMENT_SURFACES: readonly LegalDocumentSurface[] = [
  'site',
  'app',
  'platform',
] as const;

export function isLegalDocumentKind(value: string): value is LegalDocumentKind {
  return (LEGAL_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function isLegalDocumentSurface(
  value: string,
): value is LegalDocumentSurface {
  return (LEGAL_DOCUMENT_SURFACES as readonly string[]).includes(value);
}

export interface LegalDocumentRow {
  kind: LegalDocumentKind;
  surface: LegalDocumentSurface;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
}

function toRow(r: typeof legalDocuments.$inferSelect): LegalDocumentRow {
  return {
    kind: r.kind as LegalDocumentKind,
    surface: r.surface as LegalDocumentSurface,
    title: r.title,
    body: r.body,
    version: r.version,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

const DEFAULT_TITLES: Record<LegalDocumentKind, string> = {
  terms_of_use: 'Termos de Uso',
  privacy_policy: 'Política de Privacidade',
};

/**
 * Garante que a row (kind, surface) existe (idempotente). Útil
 * pra ambientes onde a migration rodou mas o seed pode ter sido
 * pulado. Primeira abertura de cada combinação cria a row default
 * se faltar.
 */
async function ensureExists(
  kind: LegalDocumentKind,
  surface: LegalDocumentSurface,
): Promise<void> {
  await db
    .insert(legalDocuments)
    .values({
      kind,
      surface,
      title: DEFAULT_TITLES[kind],
      body: '',
      version: 1,
      publishedAt: null,
    })
    .onConflictDoNothing({
      target: [legalDocuments.kind, legalDocuments.surface],
    });
}

export async function getLegalDocument(
  kind: LegalDocumentKind,
  surface: LegalDocumentSurface,
): Promise<LegalDocumentRow> {
  await ensureExists(kind, surface);
  const [row] = await db
    .select()
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.kind, kind),
        eq(legalDocuments.surface, surface),
      ),
    )
    .limit(1);
  return toRow(row);
}

/**
 * Lista TODOS os documentos (6 rows). Usado pelo admin pra
 * popular o estado inicial das tabs surface × kind.
 */
export async function listLegalDocuments(): Promise<LegalDocumentRow[]> {
  /* Garante que TODAS as 6 combinações existem antes de listar —
   * cobre ambientes onde o seed pulou ou tabela foi recriada
   * sem rodar a migration 0044. */
  for (const kind of LEGAL_DOCUMENT_KINDS) {
    for (const surface of LEGAL_DOCUMENT_SURFACES) {
      await ensureExists(kind, surface);
    }
  }
  const rows = await db.select().from(legalDocuments);
  /* Ordem determinística: surface (site, app, platform), depois
   * kind (terms_of_use, privacy_policy). Ajuda o admin a sempre
   * ver os mesmos itens na mesma sequência. */
  const orderKey = (r: typeof rows[number]) => {
    const sIdx = LEGAL_DOCUMENT_SURFACES.indexOf(
      r.surface as LegalDocumentSurface,
    );
    const kIdx = LEGAL_DOCUMENT_KINDS.indexOf(r.kind as LegalDocumentKind);
    return sIdx * 10 + kIdx;
  };
  return rows.sort((a, b) => orderKey(a) - orderKey(b)).map(toRow);
}

export interface SaveLegalInput {
  title?: string;
  body: string;
}

/**
 * Salva rascunho — não publica. Site/app/plataforma continuam
 * vendo a última versão publicada (ou nada, se nunca publicado).
 */
export async function saveLegalDocument(
  kind: LegalDocumentKind,
  surface: LegalDocumentSurface,
  input: SaveLegalInput,
  actorId: string,
): Promise<LegalDocumentRow> {
  await ensureExists(kind, surface);
  const patch: Partial<typeof legalDocuments.$inferInsert> = {
    body: input.body,
    updatedAt: new Date(),
    updatedBy: actorId,
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  const [row] = await db
    .update(legalDocuments)
    .set(patch)
    .where(
      and(
        eq(legalDocuments.kind, kind),
        eq(legalDocuments.surface, surface),
      ),
    )
    .returning();
  return toRow(row);
}

/**
 * Publica — bumpa version + grava publishedAt. Site/app/plataforma
 * passam a renderizar o conteúdo novo na próxima requisição.
 *
 * Publica APENAS o (kind, surface) dado — não cascateia pra outras
 * surfaces. Isso é proposital: cada surface tem fluxo de aprovação
 * independente. Pra propagar copy de uma pra outra, o admin precisa
 * editar e publicar cada uma.
 */
export async function publishLegalDocument(
  kind: LegalDocumentKind,
  surface: LegalDocumentSurface,
  input: SaveLegalInput,
  actorId: string,
): Promise<LegalDocumentRow> {
  await ensureExists(kind, surface);
  const [current] = await db
    .select({ version: legalDocuments.version })
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.kind, kind),
        eq(legalDocuments.surface, surface),
      ),
    )
    .limit(1);
  const nextVersion = (current?.version ?? 0) + 1;
  const patch: Partial<typeof legalDocuments.$inferInsert> = {
    body: input.body,
    version: nextVersion,
    publishedAt: new Date(),
    updatedAt: new Date(),
    updatedBy: actorId,
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  const [row] = await db
    .update(legalDocuments)
    .set(patch)
    .where(
      and(
        eq(legalDocuments.kind, kind),
        eq(legalDocuments.surface, surface),
      ),
    )
    .returning();
  return toRow(row);
}

/**
 * Leitor público — usado por /termos /privacidade (surface=site),
 * pelo modal in-app (surface=app), e pela futura página da
 * plataforma web (surface=platform).
 *
 * Retorna `null` quando o documento ainda não foi publicado pra
 * AQUELA surface — UI mostra placeholder "em breve" em vez de erro.
 */
export async function getPublishedLegalDocument(
  kind: LegalDocumentKind,
  surface: LegalDocumentSurface,
): Promise<LegalDocumentRow | null> {
  const [row] = await db
    .select()
    .from(legalDocuments)
    .where(
      and(
        eq(legalDocuments.kind, kind),
        eq(legalDocuments.surface, surface),
      ),
    )
    .limit(1);
  if (!row || row.publishedAt === null) return null;
  return toRow(row);
}
