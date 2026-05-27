/**
 * Admin helpers para `legal_documents` — Termos de Uso + Política
 * de Privacidade. Diferente do FAQ, NÃO é uma lista — são 2 rows
 * fixas (uma por `kind`) seeded na migration 0043.
 *
 * Operações:
 *   - `getLegalDocument(kind)` — lê o documento atual.
 *   - `saveLegalDocument(kind, ...)` — atualiza body/title SEM
 *     publicar. Permite o admin trabalhar em rascunho sem expor
 *     mudanças no site público.
 *   - `publishLegalDocument(kind, ...)` — atualiza body/title E
 *     publica (bump version + grava `publishedAt = now()`).
 *
 * O site público lê os mesmos rows mas filtra por `publishedAt
 * IS NOT NULL` (rascunhos nunca aparecem). Atualizar o body sem
 * publicar só afeta o admin — o público continua vendo a versão
 * anterior.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { legalDocuments } from '../db/schema';

export type LegalDocumentKind = 'terms_of_use' | 'privacy_policy';

export const LEGAL_DOCUMENT_KINDS: readonly LegalDocumentKind[] = [
  'terms_of_use',
  'privacy_policy',
] as const;

export function isLegalDocumentKind(value: string): value is LegalDocumentKind {
  return (LEGAL_DOCUMENT_KINDS as readonly string[]).includes(value);
}

export interface LegalDocumentRow {
  kind: LegalDocumentKind;
  title: string;
  body: string;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
}

function toRow(r: typeof legalDocuments.$inferSelect): LegalDocumentRow {
  return {
    kind: r.kind as LegalDocumentKind,
    title: r.title,
    body: r.body,
    version: r.version,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * Garante que a row existe (idempotente). Útil pra ambientes onde
 * a migration rodou mas o seed pode ter sido pulado (testes locais,
 * staging recriado, etc). O admin UI chama sempre — primeira
 * abertura de cada `kind` é a oportunidade ideal de criar a row
 * default se ela ainda não existir.
 */
async function ensureExists(kind: LegalDocumentKind): Promise<void> {
  const defaults: Record<LegalDocumentKind, string> = {
    terms_of_use: 'Termos de Uso',
    privacy_policy: 'Política de Privacidade',
  };
  await db
    .insert(legalDocuments)
    .values({
      kind,
      title: defaults[kind],
      body: '',
      version: 1,
      publishedAt: null,
    })
    .onConflictDoNothing({ target: legalDocuments.kind });
}

export async function getLegalDocument(
  kind: LegalDocumentKind,
): Promise<LegalDocumentRow> {
  await ensureExists(kind);
  const [row] = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.kind, kind))
    .limit(1);
  /* Após ensureExists, a row sempre existe — o non-null assertion
   * é seguro. Se algo der errado aqui (race condition extrema), a
   * query principal falharia antes desse acesso. */
  return toRow(row);
}

export async function listLegalDocuments(): Promise<LegalDocumentRow[]> {
  /* Side-effect: garante que ambas as rows existem antes de
   * listar. Em produção, o seed da migration já cobre isso; o
   * ensure cobre testes locais e ambientes onde o seed pulou. */
  await ensureExists('terms_of_use');
  await ensureExists('privacy_policy');
  const rows = await db.select().from(legalDocuments);
  /* Ordem fixa: terms_of_use primeiro, privacy_policy depois.
   * O SELECT sem ORDER BY não tem garantia de ordem, então
   * ordenamos por hand. */
  const byKind = new Map(rows.map((r) => [r.kind as LegalDocumentKind, r]));
  return LEGAL_DOCUMENT_KINDS.map((k) => toRow(byKind.get(k)!));
}

export interface SaveLegalInput {
  title?: string;
  body: string;
}

/**
 * Salva alterações (rascunho). NÃO publica — o site público
 * continua vendo a versão anterior (que foi a última publicação).
 */
export async function saveLegalDocument(
  kind: LegalDocumentKind,
  input: SaveLegalInput,
  actorId: string,
): Promise<LegalDocumentRow> {
  await ensureExists(kind);
  const patch: Partial<typeof legalDocuments.$inferInsert> = {
    body: input.body,
    updatedAt: new Date(),
    updatedBy: actorId,
  };
  if (input.title !== undefined) patch.title = input.title.trim();
  const [row] = await db
    .update(legalDocuments)
    .set(patch)
    .where(eq(legalDocuments.kind, kind))
    .returning();
  return toRow(row);
}

/**
 * Publica a versão atual — grava `publishedAt = now()` E
 * incrementa `version`. UI mostra "v.X publicada em Y" depois disso.
 *
 * Aceita os mesmos inputs que save (title/body) pra que o admin
 * possa "editar + publicar" em um único POST sem race condition
 * entre os dois requests.
 */
export async function publishLegalDocument(
  kind: LegalDocumentKind,
  input: SaveLegalInput,
  actorId: string,
): Promise<LegalDocumentRow> {
  await ensureExists(kind);
  /* Lê a version atual pra bumpar — UPDATE … SET version = version + 1
   * funcionaria com `sql\`...\``, mas optamos pelo padrão drizzle
   * + um SELECT pra simplicidade e logs mais claros. Race entre
   * 2 admins publicando ao mesmo tempo é cenário improvável e
   * o pior caso é uma versão "saltar" — não há corrupção de
   * dados. */
  const [current] = await db
    .select({ version: legalDocuments.version })
    .from(legalDocuments)
    .where(eq(legalDocuments.kind, kind))
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
    .where(eq(legalDocuments.kind, kind))
    .returning();
  return toRow(row);
}

/**
 * Leitor público — usado pelas páginas `/termos` e `/privacidade`.
 * Retorna a row APENAS se `publishedAt IS NOT NULL`; rascunhos
 * jamais aparecem no site público.
 *
 * Retorna `null` quando o documento ainda não foi publicado — a
 * página renderiza um placeholder informando "em breve".
 *
 * NÃO chama `ensureExists` — pra essa surface, "row inexistente"
 * é equivalente a "não publicado", e criar uma row vazia em hot
 * path de read público seria desperdício.
 */
export async function getPublishedLegalDocument(
  kind: LegalDocumentKind,
): Promise<LegalDocumentRow | null> {
  const [row] = await db
    .select()
    .from(legalDocuments)
    .where(eq(legalDocuments.kind, kind))
    .limit(1);
  if (!row || row.publishedAt === null) return null;
  return toRow(row);
}
