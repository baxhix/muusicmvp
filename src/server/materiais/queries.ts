import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { env } from '../env';
import { materialNodes, users, type MaterialNode } from '../db/schema';

/** Converte URL relativa em absoluta usando APP_URL. Idempotente:
 *  já-absolutas (http/https) passam direto. Backfill defensivo
 *  pra registros antigos que foram salvos com path relativo. */
function absolutize(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${env.APP_URL}${url}`;
  return url; // data: URL ou outro esquema — passa direto
}

/* ──────────────────────────────────────────────────────────────
 * Tipos canônicos de aplicação (espelha o que a UI consome).
 * Conversão DB row → API shape acontece via mapNode/mapNodeWithAuthor
 * — mantém o backend nullable strict e a API "pretty".
 * ────────────────────────────────────────────────────────────── */

export type MaterialAudience =
  | 'top1' | 'top10' | 'top50' | 'top100' | 'all';

export type MaterialFormato =
  | 'jpg' | 'png' | 'svg' | 'mp3' | 'mp4' | 'pdf' | 'zip';

export type MaterialStatus =
  | 'rascunho' | 'publicado' | 'agendado' | 'arquivado';

export interface ApiMaterialFolder {
  id: string;
  type: 'folder';
  name: string;
  parentId: string | null;
  description: string | null;
  /** Tier de acesso da pasta. Só faz sentido em pastas de
   *  primeiro nível (parentId === null) — subpastas e arquivos
   *  herdam da raiz no momento da entrega. */
  audience: MaterialAudience;
}

export interface ApiMaterialFile {
  id: string;
  type: 'file';
  name: string;
  parentId: string;
  formato: MaterialFormato;
  thumb: string;
  fileUrl: string;
  filename: string;
  tamanhoBytes: number;
  status: MaterialStatus;
  publicadoEm: string; // ISO
  publishedToFeed: boolean;
  downloads: number;
  favoritos: number;
  description: string;
  audience: MaterialAudience;
  createdBy: { id: string; name: string } | null;
}

export type ApiMaterialNode = ApiMaterialFolder | ApiMaterialFile;

/* ──────────────────────────────────────────────────────────────
 * Mappers — DB → API
 * ────────────────────────────────────────────────────────────── */

interface DbRowWithAuthor {
  node: MaterialNode;
  authorName: string | null;
  authorId: string | null;
}

/**
 * Converte uma row do DB (com author opcional) pro shape que a UI
 * consome. Garante que campos `notNull` da UI (que no DB são
 * nullable porque uma única tabela mistura folder e file) caiam
 * em defaults sensatos.
 */
export function mapNodeWithAuthor(
  row: DbRowWithAuthor,
): ApiMaterialNode {
  const n = row.node;
  if (n.type === 'folder') {
    return {
      id: n.id,
      type: 'folder',
      name: n.name,
      parentId: n.parentId,
      description: n.description,
      audience: (n.audience ?? 'all') as MaterialAudience,
    };
  }
  // File — vários campos podem ser null por causa da union de
  // tipos no DB. Casts defensivos pra que a API sempre devolva
  // valores presentes.
  /* URLs sempre saem absolutas — defensivo contra dados antigos
   * salvos com path relativo (antes do fix em storage.ts).
   * Admin renderiza <img> apontando pro main app via APP_URL. */
  return {
    id: n.id,
    type: 'file',
    name: n.name,
    parentId: n.parentId ?? '',
    formato: (n.formato ?? 'jpg') as MaterialFormato,
    thumb: absolutize(n.thumbUrl ?? n.fileUrl) || '/icon-chapeu-ac.svg',
    fileUrl: absolutize(n.fileUrl),
    filename: n.filename ?? '',
    tamanhoBytes: n.tamanhoBytes ?? 0,
    status: (n.status ?? 'publicado') as MaterialStatus,
    publicadoEm: (n.publicadoEm ?? n.createdAt).toISOString(),
    publishedToFeed: n.publishedToFeed,
    downloads: n.downloads,
    favoritos: n.favoritos,
    description: n.description ?? '',
    audience: (n.audience ?? 'all') as MaterialAudience,
    createdBy:
      row.authorId && row.authorName
        ? { id: row.authorId, name: row.authorName }
        : null,
  };
}

/* ──────────────────────────────────────────────────────────────
 * Queries
 * ────────────────────────────────────────────────────────────── */

/**
 * Lista a árvore inteira em uma query única, com author join.
 *
 * Decisão de design: trazer TUDO de uma vez é simples e barato pra
 * volumes esperados (centenas de nodes — não milhões). Quando o
 * acervo crescer, paginar por parent_id no list endpoint.
 */
export async function listMateriaisTree(): Promise<ApiMaterialNode[]> {
  const rows = await db
    .select({
      node: materialNodes,
      authorId: users.id,
      authorName: users.name,
    })
    .from(materialNodes)
    .leftJoin(users, eq(materialNodes.createdById, users.id))
    .orderBy(materialNodes.createdAt);
  return rows.map(mapNodeWithAuthor);
}

/** Busca um único node por id (com author join). */
export async function getMaterialNode(id: string): Promise<{
  node: MaterialNode;
  api: ApiMaterialNode;
} | null> {
  const rows = await db
    .select({
      node: materialNodes,
      authorId: users.id,
      authorName: users.name,
    })
    .from(materialNodes)
    .leftJoin(users, eq(materialNodes.createdById, users.id))
    .where(eq(materialNodes.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { node: row.node, api: mapNodeWithAuthor(row) };
}

/* ── Mutations ──────────────────────────────────────────────── */

export interface CreateFolderInput {
  name: string;
  description?: string | null;
  parentId?: string | null;
  audience?: MaterialAudience;
  createdById?: string | null;
}

export async function createFolder(
  input: CreateFolderInput,
): Promise<ApiMaterialNode> {
  const [inserted] = await db
    .insert(materialNodes)
    .values({
      type: 'folder',
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
      audience: input.audience ?? 'all',
      createdById: input.createdById ?? null,
    })
    .returning();
  return mapNodeWithAuthor({
    node: inserted,
    authorId: null,
    authorName: null,
  });
}

/** Lê só a audiência de um node (folder) — usado pra herança
 *  ao criar arquivos. Quick query sem joins. Retorna 'all'
 *  como default seguro se o node não existir. */
export async function getFolderAudience(
  folderId: string,
): Promise<MaterialAudience> {
  const rows = await db
    .select({ audience: materialNodes.audience })
    .from(materialNodes)
    .where(eq(materialNodes.id, folderId))
    .limit(1);
  return (rows[0]?.audience ?? 'all') as MaterialAudience;
}

export interface CreateFileInput {
  name: string;
  parentId: string; // arquivos sempre vivem numa pasta
  formato: MaterialFormato;
  fileUrl: string;
  thumbUrl: string;
  filename: string;
  tamanhoBytes: number;
  description: string;
  audience: MaterialAudience;
  publishedToFeed?: boolean;
  status?: MaterialStatus;
  createdById?: string | null;
}

export async function createFile(
  input: CreateFileInput,
): Promise<ApiMaterialNode> {
  const [inserted] = await db
    .insert(materialNodes)
    .values({
      type: 'file',
      name: input.name,
      parentId: input.parentId,
      description: input.description,
      formato: input.formato,
      fileUrl: input.fileUrl,
      thumbUrl: input.thumbUrl,
      filename: input.filename,
      tamanhoBytes: input.tamanhoBytes,
      status: input.status ?? 'publicado',
      publicadoEm: new Date(),
      publishedToFeed: input.publishedToFeed ?? false,
      audience: input.audience,
      createdById: input.createdById ?? null,
    })
    .returning();
  return mapNodeWithAuthor({
    node: inserted,
    authorId: null,
    authorName: null,
  });
}

export interface UpdateNodeInput {
  name?: string;
  description?: string | null;
  audience?: MaterialAudience;
  status?: MaterialStatus;
  publishedToFeed?: boolean;
}

export async function updateNode(
  id: string,
  patch: UpdateNodeInput,
): Promise<ApiMaterialNode | null> {
  const patchPayload: Partial<typeof materialNodes.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.name !== undefined)              patchPayload.name = patch.name;
  if (patch.description !== undefined)       patchPayload.description = patch.description;
  if (patch.audience !== undefined)          patchPayload.audience = patch.audience;
  if (patch.status !== undefined)            patchPayload.status = patch.status;
  if (patch.publishedToFeed !== undefined)   patchPayload.publishedToFeed = patch.publishedToFeed;

  const [updated] = await db
    .update(materialNodes)
    .set(patchPayload)
    .where(eq(materialNodes.id, id))
    .returning();
  if (!updated) return null;
  /* Re-busca pra trazer o author junto — alternativa seria
   *  manter o id e fazer SELECT, mas o cost é o mesmo. */
  return (await getMaterialNode(id))?.api ?? null;
}

/**
 * Coleta os filenames de TODOS os descendentes (recursivo) de um
 * node — útil pra apagar os binários do disco ANTES de remover
 * o registro (cascade no DB resolve as linhas, não os arquivos).
 *
 * Usa recursive CTE pra fazer numa única round-trip.
 */
export async function collectFilenamesDeep(
  rootId: string,
): Promise<string[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE descendants AS (
      SELECT id, parent_id, filename, type FROM material_nodes WHERE id = ${rootId}
      UNION ALL
      SELECT n.id, n.parent_id, n.filename, n.type
      FROM material_nodes n
      INNER JOIN descendants d ON n.parent_id = d.id
    )
    SELECT filename FROM descendants WHERE type = 'file' AND filename IS NOT NULL;
  `);
  // drizzle pg client retorna rows como Record<string,unknown>[].
  // Cast em duas etapas (via unknown) pra contornar o
  // strict-overlap do TS. O shape vem da CTE, controlado por
  // nós; runtime safe.
  const rows = (result as unknown as { rows: { filename: string }[] }).rows;
  return rows.map((r) => r.filename);
}

/** Remove um node (cascade limpa descendants via FK). Retorna
 *  true se removeu, false se não existia. */
export async function deleteNode(id: string): Promise<boolean> {
  const result = await db
    .delete(materialNodes)
    .where(eq(materialNodes.id, id))
    .returning({ id: materialNodes.id });
  return result.length > 0;
}

/** Increment de downloads pra analytics. */
export async function incrementDownloads(id: string): Promise<void> {
  await db
    .update(materialNodes)
    .set({ downloads: sql`${materialNodes.downloads} + 1` })
    .where(eq(materialNodes.id, id));
}
