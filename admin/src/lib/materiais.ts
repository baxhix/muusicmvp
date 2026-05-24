/**
 * Materiais — constantes de rendering + helpers puros sobre a árvore.
 *
 * Tipos vivem em `@/types/materiais.ts`. Este arquivo concentra:
 *   - Metadata por enum (labels, tons, descrições) — fonte única de
 *     verdade pra UI (Badge, Select, Dialog).
 *   - Helpers funcionais sobre a lista flat de nós (childrenOf,
 *     pathOf, findNode, summarizeTree).
 *
 * Mantemos a árvore como lista flat com parentId em vez de nested
 * porque facilita: (a) busca por id, (b) filter por parent na
 * grid view, (c) inserção/remoção idempotente sem walkar a árvore.
 */

import type {
  MaterialAudience,
  MaterialAudienceMeta,
  MaterialFile,
  MaterialFolder,
  MaterialNode,
  MaterialStatus,
} from '@/types/materiais';

/* ──────────────────────────────────────────────────────────────
 * Metadata constants (rendering)
 * ────────────────────────────────────────────────────────────── */

export const MATERIAL_AUDIENCE_META: Record<MaterialAudience, MaterialAudienceMeta> = {
  top1: {
    id: 'top1',
    label: 'Top 1',
    shortLabel: 'Top 1',
    tone: 'warning', // amber — máxima exclusividade
    description: 'Só pra o superfã número 1 do ranking.',
  },
  top10: {
    id: 'top10',
    label: 'Top 10',
    shortLabel: 'Top 10',
    tone: 'brand', // magenta — alta exclusividade
    description: 'Os 10 superfãs mais engajados.',
  },
  top50: {
    id: 'top50',
    label: 'Top 50',
    shortLabel: 'Top 50',
    tone: 'info', // azul/roxo — exclusivo
    description: 'Os 50 superfãs no topo do ranking.',
  },
  top100: {
    id: 'top100',
    label: 'Top 100',
    shortLabel: 'Top 100',
    tone: 'success', // verde — premium
    description: 'Os 100 superfãs mais ativos.',
  },
  all: {
    id: 'all',
    label: 'Todos os fãs',
    shortLabel: 'Todos',
    tone: 'neutral', // cinza — aberto
    description: 'Disponível pra qualquer usuário cadastrado.',
  },
};

/** Lista ordenada do mais restrito pro mais aberto — usada nos
 *  Selects/dialogs (UI mantém uma ordem consistente). */
export const MATERIAL_AUDIENCE_ORDER: MaterialAudience[] = [
  'top1',
  'top10',
  'top50',
  'top100',
  'all',
];

/** Status → label para Badge. */
export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  rascunho:  'Rascunho',
  publicado: 'Publicado',
  agendado:  'Agendado',
  arquivado: 'Arquivado',
};

/* ──────────────────────────────────────────────────────────────
 * Helpers — operações puras sobre a árvore (lista flat).
 * ────────────────────────────────────────────────────────────── */

/** Filhos diretos de uma pasta (id null = raiz). */
export function childrenOf(
  nodes: MaterialNode[],
  parentId: string | null,
): MaterialNode[] {
  return nodes.filter((n) => n.parentId === parentId);
}

/** Caminho da raiz até o nó alvo — array de pastas (pra breadcrumb). */
export function pathOf(
  nodes: MaterialNode[],
  targetId: string | null,
): MaterialFolder[] {
  if (targetId === null) return [];
  const path: MaterialFolder[] = [];
  let cursor: MaterialNode | undefined = nodes.find((n) => n.id === targetId);
  while (cursor) {
    if (cursor.type === 'folder') path.unshift(cursor);
    const parentId: string | null = cursor.parentId;
    cursor = parentId ? nodes.find((n) => n.id === parentId) : undefined;
  }
  return path;
}

/** Encontra um nó por id. */
export function findNode(
  nodes: MaterialNode[],
  id: string | null,
): MaterialNode | undefined {
  if (!id) return undefined;
  return nodes.find((n) => n.id === id);
}

/** Sumário global do acervo (pra KPIs no header da página). */
export function summarizeTree(nodes: MaterialNode[]) {
  const files = nodes.filter((n): n is MaterialFile => n.type === 'file');
  const folders = nodes.filter((n): n is MaterialFolder => n.type === 'folder');
  return {
    totalFiles: files.length,
    totalFolders: folders.length,
    totalDownloads: files.reduce((sum, f) => sum + f.downloads, 0),
    totalFavoritos: files.reduce((sum, f) => sum + f.favoritos, 0),
    noFeed: files.filter((f) => f.publishedToFeed).length,
    totalBytes: files.reduce((sum, f) => sum + f.tamanhoBytes, 0),
  };
}
