/**
 * Materiais — tipos + metadata + helpers de árvore.
 *
 * Modela o acervo como uma árvore de nós (pastas + arquivos)
 * navegável via breadcrumb. Cada nó tem `parentId` apontando pro
 * container — `null` significa raiz.
 *
 * Fonte de dados em runtime: backend (`listMateriais()` em
 * services/materiais.ts → GET /api/admin/materiais). O nome do
 * arquivo é histórico — começou como mock 100% client-side antes
 * do schema/API caírem; hoje só hospeda tipos compartilhados +
 * funções puras de árvore.
 */

/* ──────────────────────────────────────────────────────────────
 * Enums
 * ────────────────────────────────────────────────────────────── */

export type MaterialFormato =
  | 'jpg' | 'png' | 'svg'
  | 'mp3' | 'mp4'
  | 'pdf' | 'zip';

export type MaterialStatus =
  | 'rascunho' | 'publicado' | 'agendado' | 'arquivado';

/**
 * Audiência permitida pra um material — controla quem pode
 * baixar/visualizar. Tiers são cumulativos: 'top10' significa
 * "top 10 ou melhor"; 'all' = todo mundo.
 *
 * Lógica de visibilidade (client-side):
 *   if (audience === 'all') visible
 *   else if (audience === 'top100' && userRank <= 100) visible
 *   else if (audience === 'top50'  && userRank <= 50)  visible
 *   ...etc.
 */
export type MaterialAudience =
  | 'top1' | 'top10' | 'top50' | 'top100' | 'all';

/* ──────────────────────────────────────────────────────────────
 * Metadata constants (rendering)
 * ────────────────────────────────────────────────────────────── */

/** Metadata por tier — usado em rendering (label, tone do Badge,
 *  descrição curta no Select/Dialog). */
export interface MaterialAudienceMeta {
  id: MaterialAudience;
  label: string;
  shortLabel: string;
  /** Tom usado no Badge/chip. */
  tone: 'neutral' | 'info' | 'brand' | 'warning' | 'success';
  description: string;
}

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
 * Shape dos nós
 * ────────────────────────────────────────────────────────────── */

export interface MaterialFolderBase {
  id: string;
  type: 'folder';
  name: string;
  parentId: string | null;
  /** Cover opcional pra ilustrar a pasta na grid view. */
  thumb?: string;
  /** Descrição curta — usada no header da pasta + no preview.
   *  Backend devolve null em vez de undefined; aceitar ambos. */
  description?: string | null;
  /** Tier de acesso — só relevante em pastas-raiz (parentId === null).
   *  Subpastas herdam da pasta-mãe. Opcional pra acomodar nós
   *  legados; o backend sempre retorna o valor (default 'all'). */
  audience?: MaterialAudience;
}

export type MaterialFolder = MaterialFolderBase;

export interface MaterialFile {
  id: string;
  type: 'file';
  name: string;
  parentId: string;
  formato: MaterialFormato;
  thumb: string;
  /** URL servida pelo backend pra baixar o binário. */
  fileUrl?: string;
  /** Filename canonical no disco do backend — necessário pro
   *  Content-Disposition do download. */
  filename?: string;
  tamanhoBytes: number;
  status: MaterialStatus;
  publicadoEm: string; // ISO
  publishedToFeed: boolean;
  downloads: number;
  favoritos: number;
  description: string;
  /** Quem pode acessar este material. Herdado da pasta-raiz no
   *  momento do upload — não editável por arquivo. */
  audience: MaterialAudience;
  /** Pode ser null quando o backend não conseguiu resolver
   *  o autor (registros antigos sem created_by_id, etc). */
  createdBy: { id: string; name: string } | null;
}

/** Nó da árvore — pasta ou arquivo. */
export type MaterialNode = MaterialFolder | MaterialFile;

/* ──────────────────────────────────────────────────────────────
 * Helpers — operações puras sobre a árvore (lista flat).
 *
 * Mantemos a árvore como lista flat com parentId em vez de nested
 * porque facilita: (a) busca por id, (b) filter por parent na
 * grid view, (c) inserção/remoção idempotente sem walkar a árvore.
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

/** Conta arquivos DENTRO de uma pasta, recursivamente. Usado no
 *  diálogo de confirmação de delete (mostra impacto). */
export function countFilesDeep(
  nodes: MaterialNode[],
  folderId: string,
): number {
  let count = 0;
  const stack: string[] = [folderId];
  while (stack.length) {
    const id = stack.pop()!;
    for (const n of nodes) {
      if (n.parentId !== id) continue;
      if (n.type === 'file') count += 1;
      else stack.push(n.id);
    }
  }
  return count;
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
