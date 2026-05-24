/**
 * Materiais — acervo hierárquico de conteúdo exclusivo da artista.
 *
 * Per product feedback "estilo pastas e subpastas, como do Google
 * Drive, finder, etc.", modelamos o acervo como uma árvore de nós
 * (pastas + arquivos) navegável via breadcrumb. Cada nó tem
 * `parentId` apontando pro container — `null` significa raiz.
 *
 * Estrutura:
 *   Materiais (root)
 *   ├─ Álbuns de fotos
 *   │  ├─ Rodeio BH (folder)
 *   │  │  ├─ palco-01.jpg
 *   │  │  ├─ bastidores-01.jpg
 *   │  │  └─ ...
 *   │  └─ Jaguariúna (folder) ...
 *   ├─ Álbuns exclusivos
 *   │  ├─ Acústico Curitiba (folder)
 *   │  │  ├─ track-01.mp3
 *   │  │  └─ ...
 *   ├─ Wallpapers
 *   │  ├─ Mobile (folder)
 *   │  └─ Desktop (folder)
 *   ├─ Figurinhas
 *   ├─ Templates
 *   └─ Logotipos
 *
 * Quando o backend cair, troca-se `loadMateriaisTree()` por
 * `fetch('/api/admin/materiais')` — o shape do nó + os renderers
 * são agnósticos da fonte.
 */

export type MaterialFormato =
  | 'jpg'
  | 'png'
  | 'pdf'
  | 'mp3'
  | 'mp4'
  | 'zip'
  | 'svg';

export type MaterialStatus = 'rascunho' | 'publicado' | 'agendado' | 'arquivado';

/**
 * Audiência permitida pra um material — controla quem pode
 * baixar/visualizar. Tiers são cumulativos: 'top10' significa
 * "top 10 ou melhor"; 'all' = todo mundo. Per product feedback
 * "inclua uma opção para o admin escolher quem poderá ter acesso
 * a este material. O top 1, 10, 50, 100 ou todos".
 *
 * Lógica de visibilidade (client-side):
 *   if (audience === 'all') visible
 *   else if (audience === 'top100' && userRank <= 100) visible
 *   else if (audience === 'top50'  && userRank <= 50)  visible
 *   ...etc.
 */
export type MaterialAudience = 'top1' | 'top10' | 'top50' | 'top100' | 'all';

/** Metadata por tier — usado pra rendering (label, tone do
 *  Badge, descrição curta no Select). */
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
 *  Selects (UI mantém uma ordem consistente). */
export const MATERIAL_AUDIENCE_ORDER: MaterialAudience[] = [
  'top1',
  'top10',
  'top50',
  'top100',
  'all',
];

/** Nó da árvore — pode ser pasta ou arquivo. */
export type MaterialNode = MaterialFolder | MaterialFile;

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
   *  Subpastas herdam da pasta-mãe. Opcional pra acomodar mocks
   *  antigos; o backend sempre retorna o valor (default 'all'). */
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
  /** URL servida pelo backend pra baixar o binário. Opcional
   *  porque arquivos mockados antigos (do tempo da localStorage)
   *  ainda não tinham esse campo. */
  fileUrl?: string;
  /** Filename canonical no disco do backend — necessário pro
   *  Content-Disposition do download. Opcional pelo mesmo
   *  motivo do fileUrl. */
  filename?: string;
  tamanhoBytes: number;
  status: MaterialStatus;
  publicadoEm: string; // ISO
  publishedToFeed: boolean;
  downloads: number;
  favoritos: number;
  description: string;
  /** Quem pode acessar este material — controla visibilidade
   *  pro fã. Editável pelo admin. */
  audience: MaterialAudience;
  /** Pode ser null quando o backend não conseguiu resolver
   *  o autor (registros antigos sem created_by_id, etc). */
  createdBy: { id: string; name: string } | null;
}

/** Status → label para Badge. */
export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  rascunho:  'Rascunho',
  publicado: 'Publicado',
  agendado:  'Agendado',
  arquivado: 'Arquivado',
};

/* ──────────────────────────────────────────────────────────────
 * Fixture data — flat list com parentId. Construímos a árvore em
 * runtime via helpers (childrenOf, pathOf). Manter flat facilita
 * (a) busca por id, (b) renderização da grid via filter, e
 * (c) migração pra um schema relacional no futuro.
 * ────────────────────────────────────────────────────────────── */

const ROOT_FOLDERS: MaterialFolder[] = [
  {
    id: 'cat-fotos-shows',
    type: 'folder',
    name: 'Álbuns de fotos',
    parentId: null,
    thumb: '/ana-castela.png',
    description: 'Registros bastidores + palco das turnês.',
  },
  {
    id: 'cat-albuns-exclusivos',
    type: 'folder',
    name: 'Álbuns exclusivos',
    parentId: null,
    thumb: '/albuns/album-livin-deluxe.jpg',
    description: 'Versões alternativas, demos e gravações privadas.',
  },
  {
    id: 'cat-wallpapers',
    type: 'folder',
    name: 'Wallpapers',
    parentId: null,
    thumb: '/albuns/album-pipoca.jpg',
    description: 'Mobile + desktop em alta resolução.',
  },
  {
    id: 'cat-figurinhas',
    type: 'folder',
    name: 'Figurinhas',
    parentId: null,
    thumb: '/ana-castela-box.jpg',
    description: 'Stickers para WhatsApp e Telegram.',
  },
  {
    id: 'cat-templates',
    type: 'folder',
    name: 'Templates',
    parentId: null,
    thumb: '/albuns/album-let-rodeo.jpg',
    description: 'Stories, posts e capas para os fãs personalizarem.',
  },
  {
    id: 'cat-logotipos',
    type: 'folder',
    name: 'Logotipos',
    parentId: null,
    thumb: '/icon-chapeu-ac.svg',
    description: 'Marca oficial em SVG e PNG, variantes light/dark.',
  },
];

const SUBFOLDERS: MaterialFolder[] = [
  // Álbuns de fotos — subpastas por show
  {
    id: 'show-rodeio-bh',
    type: 'folder',
    name: 'Rodeio BH · Out 2025',
    parentId: 'cat-fotos-shows',
    thumb: '/ana-castela.png',
    description: 'Show de Belo Horizonte — palco, bastidores e camarins.',
  },
  {
    id: 'show-jaguariuna',
    type: 'folder',
    name: 'Jaguariúna Festival',
    parentId: 'cat-fotos-shows',
    thumb: '/central-anacastela.png',
    description: 'Maior festival country de SP — palco e público.',
  },
  {
    id: 'show-fortaleza',
    type: 'folder',
    name: 'Fortaleza · Verão de cowboy',
    parentId: 'cat-fotos-shows',
    thumb: '/ana-castela-box.jpg',
    description: 'Show beira-mar no Aterro de Iracema.',
  },
  // Álbuns exclusivos — subpastas por sessão
  {
    id: 'album-acustico-curitiba',
    type: 'folder',
    name: 'Acústico Curitiba',
    parentId: 'cat-albuns-exclusivos',
    thumb: '/albuns/album-livin-deluxe.jpg',
    description: 'Sessão íntima em estúdio com voz e violão.',
  },
  {
    id: 'album-demos-2025',
    type: 'folder',
    name: 'Demos perdidas 2025',
    parentId: 'cat-albuns-exclusivos',
    thumb: '/albuns/album-pipoca.jpg',
    description: 'Versões iniciais — voz guia, em construção.',
  },
  // Wallpapers — subpastas por device
  {
    id: 'wp-mobile',
    type: 'folder',
    name: 'Mobile',
    parentId: 'cat-wallpapers',
    description: '1080×2400 pra Android e iPhone.',
  },
  {
    id: 'wp-desktop',
    type: 'folder',
    name: 'Desktop',
    parentId: 'cat-wallpapers',
    description: '4K e ultrawide.',
  },
];

const FILES: MaterialFile[] = [
  // ── Show Rodeio BH (5 arquivos) ───────────────────
  {
    id: 'f-rodeiobh-palco-01',
    type: 'file',
    name: 'palco-abertura.jpg',
    parentId: 'show-rodeio-bh',
    formato: 'jpg',
    thumb: '/ana-castela.png',
    tamanhoBytes: 4_280_000,
    status: 'publicado',
    publicadoEm: '2026-04-12T18:00:00.000Z',
    publishedToFeed: true,
    downloads: 2842,
    favoritos: 814,
    description: 'Frame icônico da abertura — entrada da artista no palco.',
    audience: 'top100',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'f-rodeiobh-publico',
    type: 'file',
    name: 'publico-vista-aerea.jpg',
    parentId: 'show-rodeio-bh',
    formato: 'jpg',
    thumb: '/ana-castela.png',
    tamanhoBytes: 5_140_000,
    status: 'publicado',
    publicadoEm: '2026-04-12T18:00:00.000Z',
    publishedToFeed: false,
    downloads: 1208,
    favoritos: 342,
    description: 'Vista aérea da arena lotada durante "Pipoca".',
    audience: 'top100',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'f-rodeiobh-bastidores-01',
    type: 'file',
    name: 'bastidores-camarim.jpg',
    parentId: 'show-rodeio-bh',
    formato: 'jpg',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 3_200_000,
    status: 'publicado',
    publicadoEm: '2026-04-12T18:00:00.000Z',
    publishedToFeed: true,
    downloads: 1908,
    favoritos: 612,
    description: 'Momento de descontração no camarim antes do show.',
    audience: 'top50',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'f-rodeiobh-todas-fotos',
    type: 'file',
    name: 'todas-fotos.zip',
    parentId: 'show-rodeio-bh',
    formato: 'zip',
    thumb: '/ana-castela.png',
    tamanhoBytes: 142_336_000,
    status: 'publicado',
    publicadoEm: '2026-04-12T18:00:00.000Z',
    publishedToFeed: false,
    downloads: 5240,
    favoritos: 1880,
    description: 'Pacote completo: 48 fotos em alta resolução.',
    audience: 'top10',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'f-rodeiobh-video-recap',
    type: 'file',
    name: 'recap-3min.mp4',
    parentId: 'show-rodeio-bh',
    formato: 'mp4',
    thumb: '/ana-castela-box.jpg',
    tamanhoBytes: 84_200_000,
    status: 'publicado',
    publicadoEm: '2026-04-14T19:00:00.000Z',
    publishedToFeed: true,
    downloads: 9410,
    favoritos: 3220,
    description: 'Vídeo recap oficial — highlights do show editados em 3 minutos.',
    audience: 'top10',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },

  // ── Jaguariúna (3 arquivos) ─────────────────────
  {
    id: 'f-jagua-palco',
    type: 'file',
    name: 'main-stage.jpg',
    parentId: 'show-jaguariuna',
    formato: 'jpg',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 6_240_000,
    status: 'publicado',
    publicadoEm: '2026-03-28T14:30:00.000Z',
    publishedToFeed: true,
    downloads: 3120,
    favoritos: 921,
    description: 'Vista frontal do palco principal durante o headliner.',
    audience: 'top100',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'f-jagua-convidados',
    type: 'file',
    name: 'duetos-convidados.jpg',
    parentId: 'show-jaguariuna',
    formato: 'jpg',
    thumb: '/ana-castela.png',
    tamanhoBytes: 4_810_000,
    status: 'publicado',
    publicadoEm: '2026-03-28T14:30:00.000Z',
    publishedToFeed: false,
    downloads: 2104,
    favoritos: 624,
    description: 'Encontro no palco com convidados surpresa.',
    audience: 'top50',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'f-jagua-pacote',
    type: 'file',
    name: 'pacote-completo.zip',
    parentId: 'show-jaguariuna',
    formato: 'zip',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 188_500_000,
    status: 'publicado',
    publicadoEm: '2026-03-28T14:30:00.000Z',
    publishedToFeed: false,
    downloads: 6580,
    favoritos: 2410,
    description: '62 fotos do show + bastidores em alta resolução.',
    audience: 'top10',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },

  // ── Fortaleza (2 arquivos) ──────────────────────
  {
    id: 'f-forta-01',
    type: 'file',
    name: 'praia-aterro.jpg',
    parentId: 'show-fortaleza',
    formato: 'jpg',
    thumb: '/ana-castela-box.jpg',
    tamanhoBytes: 5_410_000,
    status: 'publicado',
    publicadoEm: '2026-02-14T22:00:00.000Z',
    publishedToFeed: false,
    downloads: 1420,
    favoritos: 380,
    description: 'Pôr-do-sol antes do show, vista do palco no Aterro.',
    audience: 'top100',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'f-forta-pacote',
    type: 'file',
    name: 'pacote-fortaleza.zip',
    parentId: 'show-fortaleza',
    formato: 'zip',
    thumb: '/ana-castela-box.jpg',
    tamanhoBytes: 96_244_000,
    status: 'publicado',
    publicadoEm: '2026-02-14T22:00:00.000Z',
    publishedToFeed: false,
    downloads: 3210,
    favoritos: 1108,
    description: '34 fotos do show beira-mar.',
    audience: 'top50',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },

  // ── Acústico Curitiba (4 arquivos) ──────────────
  {
    id: 'f-acust-01',
    type: 'file',
    name: '01-pipoca-acustico.mp3',
    parentId: 'album-acustico-curitiba',
    formato: 'mp3',
    thumb: '/albuns/album-livin-deluxe.jpg',
    tamanhoBytes: 8_240_000,
    status: 'publicado',
    publicadoEm: '2026-04-02T10:00:00.000Z',
    publishedToFeed: true,
    downloads: 12_840,
    favoritos: 5840,
    description: 'Pipoca em versão acústica — voz + violão.',
    audience: 'top50',
    createdBy: { id: 'team-music', name: 'Equipe Música' },
  },
  {
    id: 'f-acust-02',
    type: 'file',
    name: '02-nosso-quadro-acustico.mp3',
    parentId: 'album-acustico-curitiba',
    formato: 'mp3',
    thumb: '/albuns/album-livin-deluxe.jpg',
    tamanhoBytes: 7_810_000,
    status: 'publicado',
    publicadoEm: '2026-04-02T10:00:00.000Z',
    publishedToFeed: false,
    downloads: 9420,
    favoritos: 4210,
    description: 'Nosso Quadro acústico — intimista.',
    audience: 'top50',
    createdBy: { id: 'team-music', name: 'Equipe Música' },
  },
  {
    id: 'f-acust-todas',
    type: 'file',
    name: 'album-completo.zip',
    parentId: 'album-acustico-curitiba',
    formato: 'zip',
    thumb: '/albuns/album-livin-deluxe.jpg',
    tamanhoBytes: 224_000_000,
    status: 'publicado',
    publicadoEm: '2026-04-02T10:00:00.000Z',
    publishedToFeed: false,
    downloads: 8240,
    favoritos: 3140,
    description: 'Álbum completo · 8 faixas em FLAC + MP3 320kbps.',
    audience: 'top10',
    createdBy: { id: 'team-music', name: 'Equipe Música' },
  },
  {
    id: 'f-acust-capa',
    type: 'file',
    name: 'capa-acustico.png',
    parentId: 'album-acustico-curitiba',
    formato: 'png',
    thumb: '/albuns/album-livin-deluxe.jpg',
    tamanhoBytes: 2_840_000,
    status: 'publicado',
    publicadoEm: '2026-04-02T10:00:00.000Z',
    publishedToFeed: false,
    downloads: 4210,
    favoritos: 1200,
    description: 'Capa oficial do álbum acústico em alta resolução.',
    audience: 'all',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },

  // ── Demos 2025 (2 arquivos) ─────────────────────
  {
    id: 'f-demos-01',
    type: 'file',
    name: 'rascunho-cowgirl.mp3',
    parentId: 'album-demos-2025',
    formato: 'mp3',
    thumb: '/albuns/album-pipoca.jpg',
    tamanhoBytes: 5_810_000,
    status: 'publicado',
    publicadoEm: '2026-03-15T12:00:00.000Z',
    publishedToFeed: false,
    downloads: 6240,
    favoritos: 2480,
    description: 'Primeira versão do single "Cowgirl" — voz guia.',
    audience: 'top1',
    createdBy: { id: 'team-music', name: 'Equipe Música' },
  },
  {
    id: 'f-demos-pack',
    type: 'file',
    name: 'todas-demos.zip',
    parentId: 'album-demos-2025',
    formato: 'zip',
    thumb: '/albuns/album-pipoca.jpg',
    tamanhoBytes: 88_400_000,
    status: 'publicado',
    publicadoEm: '2026-03-15T12:00:00.000Z',
    publishedToFeed: false,
    downloads: 8420,
    favoritos: 3120,
    description: '5 demos completas em qualidade de estúdio.',
    audience: 'top10',
    createdBy: { id: 'team-music', name: 'Equipe Música' },
  },

  // ── Wallpapers Mobile (3 arquivos) ─────────────
  {
    id: 'f-wp-mob-rodeio',
    type: 'file',
    name: 'rodeio-1080x2400.png',
    parentId: 'wp-mobile',
    formato: 'png',
    thumb: '/ana-castela.png',
    tamanhoBytes: 3_400_000,
    status: 'publicado',
    publicadoEm: '2026-04-01T09:00:00.000Z',
    publishedToFeed: false,
    downloads: 18_244,
    favoritos: 5412,
    description: 'Wallpaper Rodeio · vertical 1080×2400, otimizado pra notch.',
    audience: 'all',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'f-wp-mob-pipoca',
    type: 'file',
    name: 'pipoca-1080x2400.png',
    parentId: 'wp-mobile',
    formato: 'png',
    thumb: '/albuns/album-pipoca.jpg',
    tamanhoBytes: 2_980_000,
    status: 'publicado',
    publicadoEm: '2026-03-20T15:00:00.000Z',
    publishedToFeed: false,
    downloads: 14_104,
    favoritos: 4221,
    description: 'A boiadeira no campo de milho — vertical pra mobile.',
    audience: 'all',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'f-wp-mob-cowgirl',
    type: 'file',
    name: 'cowgirl-pack-6.zip',
    parentId: 'wp-mobile',
    formato: 'zip',
    thumb: '/albuns/album-livin-deluxe.jpg',
    tamanhoBytes: 24_800_000,
    status: 'publicado',
    publicadoEm: '2026-02-28T10:00:00.000Z',
    publishedToFeed: true,
    downloads: 31_840,
    favoritos: 12_490,
    description: 'Pacote de 6 wallpapers cowgirl em variações de cor.',
    audience: 'top100',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },

  // ── Wallpapers Desktop (2 arquivos) ─────────────
  {
    id: 'f-wp-desk-rodeio',
    type: 'file',
    name: 'rodeio-3840x2160.png',
    parentId: 'wp-desktop',
    formato: 'png',
    thumb: '/ana-castela.png',
    tamanhoBytes: 8_800_000,
    status: 'publicado',
    publicadoEm: '2026-04-01T09:00:00.000Z',
    publishedToFeed: false,
    downloads: 9421,
    favoritos: 3120,
    description: 'Rodeio em 4K wide pra desktop.',
    audience: 'top100',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'f-wp-desk-ultrawide',
    type: 'file',
    name: 'ultrawide-5120x1440.png',
    parentId: 'wp-desktop',
    formato: 'png',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 14_200_000,
    status: 'publicado',
    publicadoEm: '2026-04-05T11:00:00.000Z',
    publishedToFeed: false,
    downloads: 2480,
    favoritos: 824,
    description: 'Versão ultrawide 32:9 pra monitores extra-largos.',
    audience: 'top100',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },

  // ── Figurinhas (direto na categoria, sem subpasta) ─
  {
    id: 'f-stickers-emoji',
    type: 'file',
    name: 'emoji-pack-1-reacoes.zip',
    parentId: 'cat-figurinhas',
    formato: 'zip',
    thumb: '/ana-castela-box.jpg',
    tamanhoBytes: 4_200_000,
    status: 'publicado',
    publicadoEm: '2026-03-10T11:00:00.000Z',
    publishedToFeed: true,
    downloads: 48_220,
    favoritos: 21_140,
    description: '24 stickers de reação pra WhatsApp e Telegram.',
    audience: 'all',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'f-stickers-frases',
    type: 'file',
    name: 'frases-iconicas.zip',
    parentId: 'cat-figurinhas',
    formato: 'zip',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 5_120_000,
    status: 'publicado',
    publicadoEm: '2026-02-22T16:00:00.000Z',
    publishedToFeed: false,
    downloads: 24_810,
    favoritos: 9420,
    description: '18 stickers com frases icônicas das músicas.',
    audience: 'all',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'f-stickers-acess',
    type: 'file',
    name: 'acessorios-country.zip',
    parentId: 'cat-figurinhas',
    formato: 'zip',
    thumb: '/ana-castela.png',
    tamanhoBytes: 3_840_000,
    status: 'rascunho',
    publicadoEm: '2026-05-15T00:00:00.000Z',
    publishedToFeed: false,
    downloads: 0,
    favoritos: 0,
    description: 'Botas, chapéus, fivelas — 14 stickers. Em finalização.',
    audience: 'top100',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },

  // ── Templates (direto na categoria) ─────────────
  {
    id: 'f-tpl-story',
    type: 'file',
    name: 'story-lancamento-9-layouts.zip',
    parentId: 'cat-templates',
    formato: 'zip',
    thumb: '/ana-castela.png',
    tamanhoBytes: 12_200_000,
    status: 'publicado',
    publicadoEm: '2026-04-08T13:00:00.000Z',
    publishedToFeed: true,
    downloads: 6240,
    favoritos: 2110,
    description: '9 layouts editáveis no Canva pra story de lançamento.',
    audience: 'top100',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'f-tpl-feed',
    type: 'file',
    name: 'post-grid-3x1.zip',
    parentId: 'cat-templates',
    formato: 'zip',
    thumb: '/albuns/album-let-rodeo.jpg',
    tamanhoBytes: 8_600_000,
    status: 'publicado',
    publicadoEm: '2026-03-30T10:30:00.000Z',
    publishedToFeed: false,
    downloads: 4108,
    favoritos: 1244,
    description: 'Trinca de posts horizontais — grid 3×1 no perfil.',
    audience: 'top100',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'f-tpl-capa',
    type: 'file',
    name: 'capa-evento-2-variantes.pdf',
    parentId: 'cat-templates',
    formato: 'pdf',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 2_440_000,
    status: 'publicado',
    publicadoEm: '2026-03-12T09:00:00.000Z',
    publishedToFeed: false,
    downloads: 1820,
    favoritos: 542,
    description: 'Cover pra fan-meet ou evento local · PDF editável.',
    audience: 'top50',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },

  // ── Logotipos (direto na categoria) ─────────────
  {
    id: 'f-logo-svg',
    type: 'file',
    name: 'logotipo-oficial.svg',
    parentId: 'cat-logotipos',
    formato: 'svg',
    thumb: '/icon-chapeu-ac.svg',
    tamanhoBytes: 12_400,
    status: 'publicado',
    publicadoEm: '2026-01-15T10:00:00.000Z',
    publishedToFeed: false,
    downloads: 5240,
    favoritos: 1840,
    description: 'Marca oficial em SVG — positiva e negativa.',
    audience: 'all',
    createdBy: { id: 'team-brand', name: 'Equipe Brand' },
  },
  {
    id: 'f-logo-png-pack',
    type: 'file',
    name: 'pack-png.zip',
    parentId: 'cat-logotipos',
    formato: 'zip',
    thumb: '/icon-chapeu-ac.svg',
    tamanhoBytes: 1_840_000,
    status: 'publicado',
    publicadoEm: '2026-01-15T10:00:00.000Z',
    publishedToFeed: false,
    downloads: 8420,
    favoritos: 2410,
    description: '6 variantes PNG em transparência (branco, preto, gradiente).',
    audience: 'all',
    createdBy: { id: 'team-brand', name: 'Equipe Brand' },
  },
  {
    id: 'f-logo-manual',
    type: 'file',
    name: 'manual-de-uso.pdf',
    parentId: 'cat-logotipos',
    formato: 'pdf',
    thumb: '/icon-chapeu-ac.svg',
    tamanhoBytes: 18_400_000,
    status: 'publicado',
    publicadoEm: '2026-01-20T14:00:00.000Z',
    publishedToFeed: false,
    downloads: 2840,
    favoritos: 624,
    description: 'Guia oficial: cores, espaçamento mínimo, usos proibidos.',
    audience: 'top100',
    createdBy: { id: 'team-brand', name: 'Equipe Brand' },
  },
];

/** Lista plana com todos os nós. Helpers consomem dali. */
export const MOCK_NODES: MaterialNode[] = [
  ...ROOT_FOLDERS,
  ...SUBFOLDERS,
  ...FILES,
];

/* ──────────────────────────────────────────────────────────────
 * Helpers — operações sobre a árvore.
 * ────────────────────────────────────────────────────────────── */

export function loadMateriaisTree(): MaterialNode[] {
  return MOCK_NODES;
}

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

/** Encontra um nó por id (helper conveniente). */
export function findNode(
  nodes: MaterialNode[],
  id: string | null,
): MaterialNode | undefined {
  if (!id) return undefined;
  return nodes.find((n) => n.id === id);
}

/** Conta itens (arquivos) DENTRO de uma pasta, recursivamente. */
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

/** Sumário global do acervo (pra KPIs no header). */
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
