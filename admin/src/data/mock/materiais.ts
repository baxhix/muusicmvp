/**
 * Materiais — mock catalog do acervo da artista.
 *
 * Modela o conteúdo exclusivo que a equipe da Ana Castela publica
 * pros superfãs: álbuns de fotos dos shows, álbuns musicais
 * exclusivos, wallpapers, figurinhas de WhatsApp, templates de
 * stories, logotipos oficiais.
 *
 * Alguns desses materiais também viram posts no feed (flag
 * `publishedToFeed`), mas o conjunto inteiro fica disponível no
 * acervo pro usuário acessar quando quiser — diferença chave em
 * relação ao feed que é cronológico/efêmero.
 *
 * Quando o backend cair, trocar `loadMateriais()` por um fetch —
 * shape dos tipos + renderers da página são agnósticos.
 */

export type MaterialCategoria =
  | 'fotos_shows'
  | 'albuns_exclusivos'
  | 'wallpapers'
  | 'figurinhas'
  | 'templates'
  | 'logotipos';

export type MaterialFormato =
  | 'jpg'
  | 'png'
  | 'pdf'
  | 'mp3'
  | 'zip'
  | 'svg'
  | 'mp4';

export type MaterialStatus = 'rascunho' | 'publicado' | 'agendado' | 'arquivado';

export interface MaterialItem {
  id: string;
  titulo: string;
  categoria: MaterialCategoria;
  formato: MaterialFormato;
  /** Thumbnail/cover usada na lista. Caminho relativo a /public. */
  thumb: string;
  /** Bytes do asset (single file ou ZIP do bundle). */
  tamanhoBytes: number;
  /** Quantos itens individuais carrega (ex: 24 fotos num álbum). */
  contagemItens?: number;
  status: MaterialStatus;
  /** Quando o material entrou no acervo (visível pro fã). */
  publicadoEm: string; // ISO
  /** Se também virou post no feed, mantém a ref. */
  publishedToFeed: boolean;
  /** Total de downloads desde a publicação. */
  downloads: number;
  /** Total de favoritos / saves pelos fãs. */
  favoritos: number;
  /** Descrição curta — mostra no detalhe + no feed quando vira post. */
  descricao: string;
  createdBy: { id: string; name: string };
}

/** Categoria → metadados pra rendering (label, descrição, count). */
export interface MaterialCategoriaMeta {
  id: MaterialCategoria;
  label: string;
  description: string;
}

export const MATERIAL_CATEGORIA_META: Record<MaterialCategoria, MaterialCategoriaMeta> = {
  fotos_shows: {
    id: 'fotos_shows',
    label: 'Álbuns de fotos',
    description: 'Registros bastidores + palco das turnês.',
  },
  albuns_exclusivos: {
    id: 'albuns_exclusivos',
    label: 'Álbuns exclusivos',
    description: 'Versões alternativas, demos e gravações privadas.',
  },
  wallpapers: {
    id: 'wallpapers',
    label: 'Wallpapers',
    description: 'Mobile + desktop em alta resolução.',
  },
  figurinhas: {
    id: 'figurinhas',
    label: 'Figurinhas',
    description: 'Stickers para WhatsApp e Telegram.',
  },
  templates: {
    id: 'templates',
    label: 'Templates',
    description: 'Stories, posts e capas para os fãs personalizarem.',
  },
  logotipos: {
    id: 'logotipos',
    label: 'Logotipos',
    description: 'Marca oficial em SVG e PNG, variantes light/dark.',
  },
};

/** Status → tone do Badge (alinhado com o resto do admin). */
export const MATERIAL_STATUS_LABEL: Record<MaterialStatus, string> = {
  rascunho:   'Rascunho',
  publicado:  'Publicado',
  agendado:   'Agendado',
  arquivado:  'Arquivado',
};

/** Dataset determinístico — não embaralha entre renders. */
export const MOCK_MATERIAIS: MaterialItem[] = [
  // ── Álbuns de fotos ──────────────────────────────────
  {
    id: 'm-show-rodeio-bh',
    titulo: 'Rodeio BH · Outubro 2025',
    categoria: 'fotos_shows',
    formato: 'zip',
    thumb: '/ana-castela.png',
    tamanhoBytes: 142_336_000,
    contagemItens: 48,
    status: 'publicado',
    publicadoEm: '2026-04-12T18:00:00.000Z',
    publishedToFeed: true,
    downloads: 8421,
    favoritos: 2156,
    descricao:
      'Bastidores + palco do show de Belo Horizonte, com fotos exclusivas dos camarins e da pré-saída.',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'm-show-jaguariuna',
    titulo: 'Jaguariúna Rodeo Festival',
    categoria: 'fotos_shows',
    formato: 'zip',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 188_500_000,
    contagemItens: 62,
    status: 'publicado',
    publicadoEm: '2026-03-28T14:30:00.000Z',
    publishedToFeed: true,
    downloads: 11_842,
    favoritos: 3294,
    descricao:
      'Fotos do maior festival country de São Paulo — palco, público, momentos com convidados.',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'm-show-fortaleza',
    titulo: 'Fortaleza · Verão de cowboy',
    categoria: 'fotos_shows',
    formato: 'zip',
    thumb: '/ana-castela-box.jpg',
    tamanhoBytes: 96_244_000,
    contagemItens: 34,
    status: 'publicado',
    publicadoEm: '2026-02-14T22:00:00.000Z',
    publishedToFeed: false,
    downloads: 5210,
    favoritos: 1487,
    descricao:
      'Praia, areia e country — registros únicos do show beira-mar no Aterro de Iracema.',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },
  {
    id: 'm-show-rio',
    titulo: 'Pedreira do Rio · Live especial',
    categoria: 'fotos_shows',
    formato: 'zip',
    thumb: '/ana-castela.png',
    tamanhoBytes: 154_980_000,
    contagemItens: 51,
    status: 'agendado',
    publicadoEm: '2026-05-25T19:00:00.000Z',
    publishedToFeed: false,
    downloads: 0,
    favoritos: 0,
    descricao:
      'Cobertura completa do gravacao live na Pedreira — sai sábado pós-edição.',
    createdBy: { id: 'team-photo', name: 'Equipe Fotografia' },
  },

  // ── Álbuns exclusivos ────────────────────────────────
  {
    id: 'm-album-acustico-curitiba',
    titulo: 'Acústico Curitiba · Sessões privadas',
    categoria: 'albuns_exclusivos',
    formato: 'zip',
    thumb: '/albuns/album-livin-deluxe.jpg',
    tamanhoBytes: 224_000_000,
    contagemItens: 8,
    status: 'publicado',
    publicadoEm: '2026-04-02T10:00:00.000Z',
    publishedToFeed: true,
    downloads: 22_540,
    favoritos: 9821,
    descricao:
      '8 faixas acústicas gravadas ao vivo num estúdio íntimo em Curitiba — só pra superfãs do Fanverse.',
    createdBy: { id: 'team-music', name: 'Equipe Música' },
  },
  {
    id: 'm-album-demos-2025',
    titulo: 'Demos perdidas 2025',
    categoria: 'albuns_exclusivos',
    formato: 'zip',
    thumb: '/albuns/album-pipoca.jpg',
    tamanhoBytes: 88_400_000,
    contagemItens: 5,
    status: 'publicado',
    publicadoEm: '2026-03-15T12:00:00.000Z',
    publishedToFeed: false,
    downloads: 14_812,
    favoritos: 6043,
    descricao:
      'Versões iniciais de músicas que não entraram no álbum oficial — com voz guia, ainda em construção.',
    createdBy: { id: 'team-music', name: 'Equipe Música' },
  },
  {
    id: 'm-album-rodeio-deluxe',
    titulo: "Let's Go Rodeo · Deluxe Edition",
    categoria: 'albuns_exclusivos',
    formato: 'zip',
    thumb: '/albuns/album-let-rodeo.jpg',
    tamanhoBytes: 312_000_000,
    contagemItens: 14,
    status: 'agendado',
    publicadoEm: '2026-08-15T00:00:00.000Z',
    publishedToFeed: false,
    downloads: 0,
    favoritos: 0,
    descricao:
      '14 faixas — versão deluxe completa, com 3 colaborações inéditas. Lançamento simultâneo nos DSPs e no Fanverse.',
    createdBy: { id: 'team-music', name: 'Equipe Música' },
  },

  // ── Wallpapers ───────────────────────────────────────
  {
    id: 'm-wp-rodeio-mobile',
    titulo: 'Rodeio · Mobile 1080×2400',
    categoria: 'wallpapers',
    formato: 'png',
    thumb: '/ana-castela.png',
    tamanhoBytes: 3_400_000,
    status: 'publicado',
    publicadoEm: '2026-04-01T09:00:00.000Z',
    publishedToFeed: false,
    downloads: 18_244,
    favoritos: 5412,
    descricao: 'Wallpaper exclusivo da capa de Rodeio — versão mobile vertical.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'm-wp-rodeio-desktop',
    titulo: 'Rodeio · Desktop 4K',
    categoria: 'wallpapers',
    formato: 'png',
    thumb: '/ana-castela.png',
    tamanhoBytes: 8_800_000,
    status: 'publicado',
    publicadoEm: '2026-04-01T09:00:00.000Z',
    publishedToFeed: false,
    downloads: 9421,
    favoritos: 3120,
    descricao: 'Versão desktop wide do wallpaper de Rodeio — 3840×2160.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'm-wp-pipoca-mobile',
    titulo: 'Pipoca · Mobile',
    categoria: 'wallpapers',
    formato: 'png',
    thumb: '/albuns/album-pipoca.jpg',
    tamanhoBytes: 2_980_000,
    status: 'publicado',
    publicadoEm: '2026-03-20T15:00:00.000Z',
    publishedToFeed: false,
    downloads: 14_104,
    favoritos: 4221,
    descricao: 'A boiadeira no campo de milho — wallpaper temático mobile.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'm-wp-cowgirl-pack',
    titulo: 'Cowgirl pack · 6 wallpapers',
    categoria: 'wallpapers',
    formato: 'zip',
    thumb: '/albuns/album-livin-deluxe.jpg',
    tamanhoBytes: 24_800_000,
    contagemItens: 6,
    status: 'publicado',
    publicadoEm: '2026-02-28T10:00:00.000Z',
    publishedToFeed: true,
    downloads: 31_840,
    favoritos: 12_490,
    descricao: 'Pacote completo de 6 wallpapers temáticos cowgirl — mobile + desktop.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },

  // ── Figurinhas ───────────────────────────────────────
  {
    id: 'm-stickers-emoji-pack-1',
    titulo: 'Emoji pack 1 · Reações',
    categoria: 'figurinhas',
    formato: 'zip',
    thumb: '/ana-castela-box.jpg',
    tamanhoBytes: 4_200_000,
    contagemItens: 24,
    status: 'publicado',
    publicadoEm: '2026-03-10T11:00:00.000Z',
    publishedToFeed: true,
    downloads: 48_220,
    favoritos: 21_140,
    descricao:
      '24 stickers de reação pra WhatsApp e Telegram — chorando, rindo, dancando, lealdade.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'm-stickers-frases',
    titulo: 'Pacote Frases',
    categoria: 'figurinhas',
    formato: 'zip',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 5_120_000,
    contagemItens: 18,
    status: 'publicado',
    publicadoEm: '2026-02-22T16:00:00.000Z',
    publishedToFeed: false,
    downloads: 24_810,
    favoritos: 9420,
    descricao: 'Stickers com frases icônicas das músicas. Bom dia, eu sou a boiadeira.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'm-stickers-acessorios',
    titulo: 'Acessórios country',
    categoria: 'figurinhas',
    formato: 'zip',
    thumb: '/ana-castela.png',
    tamanhoBytes: 3_840_000,
    contagemItens: 14,
    status: 'rascunho',
    publicadoEm: '2026-05-15T00:00:00.000Z',
    publishedToFeed: false,
    downloads: 0,
    favoritos: 0,
    descricao: 'Botas, chapéus, fivelas — stickers temáticos do universo country. Ainda em finalização.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },

  // ── Templates ────────────────────────────────────────
  {
    id: 'm-tpl-stories-launch',
    titulo: 'Story de lançamento · 9 layouts',
    categoria: 'templates',
    formato: 'zip',
    thumb: '/ana-castela.png',
    tamanhoBytes: 12_200_000,
    contagemItens: 9,
    status: 'publicado',
    publicadoEm: '2026-04-08T13:00:00.000Z',
    publishedToFeed: true,
    downloads: 6240,
    favoritos: 2110,
    descricao:
      'Templates editáveis no Canva pros fãs anunciarem o lançamento de Rodeio Deluxe nos seus stories.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'm-tpl-feed-post',
    titulo: 'Post de feed · Grid 3×1',
    categoria: 'templates',
    formato: 'zip',
    thumb: '/albuns/album-let-rodeo.jpg',
    tamanhoBytes: 8_600_000,
    contagemItens: 3,
    status: 'publicado',
    publicadoEm: '2026-03-30T10:30:00.000Z',
    publishedToFeed: false,
    downloads: 4108,
    favoritos: 1244,
    descricao:
      'Trinca de posts horizontais que formam o grid completo no perfil — versões claras e escuras.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },
  {
    id: 'm-tpl-capa-evento',
    titulo: 'Capa de evento · 2 variantes',
    categoria: 'templates',
    formato: 'pdf',
    thumb: '/central-anacastela.png',
    tamanhoBytes: 2_440_000,
    contagemItens: 2,
    status: 'publicado',
    publicadoEm: '2026-03-12T09:00:00.000Z',
    publishedToFeed: false,
    downloads: 1820,
    favoritos: 542,
    descricao: 'Cover pra fan-meet ou evento local. PDF editável.',
    createdBy: { id: 'team-design', name: 'Equipe Design' },
  },

  // ── Logotipos ────────────────────────────────────────
  {
    id: 'm-logo-oficial-svg',
    titulo: 'Logotipo oficial · SVG',
    categoria: 'logotipos',
    formato: 'svg',
    thumb: '/icon-chapeu-ac.svg',
    tamanhoBytes: 12_400,
    status: 'publicado',
    publicadoEm: '2026-01-15T10:00:00.000Z',
    publishedToFeed: false,
    downloads: 5240,
    favoritos: 1840,
    descricao:
      'Marca oficial em formato vetorial. Variantes positiva e negativa inclusas.',
    createdBy: { id: 'team-brand', name: 'Equipe Brand' },
  },
  {
    id: 'm-logo-pack-png',
    titulo: 'Logotipo · Pack PNG',
    categoria: 'logotipos',
    formato: 'zip',
    thumb: '/icon-chapeu-ac.svg',
    tamanhoBytes: 1_840_000,
    contagemItens: 6,
    status: 'publicado',
    publicadoEm: '2026-01-15T10:00:00.000Z',
    publishedToFeed: false,
    downloads: 8420,
    favoritos: 2410,
    descricao:
      'PNGs em transparência: branco, preto, gradiente, marca dágua — 6 versões em alta resolução.',
    createdBy: { id: 'team-brand', name: 'Equipe Brand' },
  },
  {
    id: 'm-logo-manual-uso',
    titulo: 'Manual de uso da marca',
    categoria: 'logotipos',
    formato: 'pdf',
    thumb: '/icon-chapeu-ac.svg',
    tamanhoBytes: 18_400_000,
    status: 'publicado',
    publicadoEm: '2026-01-20T14:00:00.000Z',
    publishedToFeed: false,
    downloads: 2840,
    favoritos: 624,
    descricao:
      'Guia oficial: cores, espaço mínimo, usos proibidos. Para parceiros e produção.',
    createdBy: { id: 'team-brand', name: 'Equipe Brand' },
  },
];

export function loadMateriais(): MaterialItem[] {
  return MOCK_MATERIAIS;
}

/** Sumário por categoria — usado pelos cards de visão geral. */
export function summarizeByCategoria(items: MaterialItem[]) {
  const out: Record<MaterialCategoria, { count: number; downloads: number }> = {
    fotos_shows:        { count: 0, downloads: 0 },
    albuns_exclusivos:  { count: 0, downloads: 0 },
    wallpapers:         { count: 0, downloads: 0 },
    figurinhas:         { count: 0, downloads: 0 },
    templates:          { count: 0, downloads: 0 },
    logotipos:          { count: 0, downloads: 0 },
  };
  for (const m of items) {
    out[m.categoria].count += 1;
    out[m.categoria].downloads += m.downloads;
  }
  return out;
}
