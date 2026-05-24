/**
 * Tipos do domínio "Materiais" — acervo de conteúdo exclusivo
 * para superfãs (estilo Google Drive). Compartilhados entre o
 * service HTTP, dialogs e components da página.
 *
 * Helpers e metadata vivem em `@/lib/materiais.ts`.
 */

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

/** Metadata por tier — usada em rendering (label, tone do Badge,
 *  descrição curta no Select/Dialog). */
export interface MaterialAudienceMeta {
  id: MaterialAudience;
  label: string;
  shortLabel: string;
  /** Tom usado no Badge/chip. */
  tone: 'neutral' | 'info' | 'brand' | 'warning' | 'success';
  description: string;
}

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
