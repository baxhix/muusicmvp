/**
 * Blog — contratos de domínio.
 *
 * Mantido em arquivo separado de `types/index.ts` (que carrega o
 * domínio existente da plataforma) pra que o módulo de blog
 * permaneça extraível como projeto independente no futuro — basta
 * mover esta pasta + a estrutura associada (services/blog,
 * data/mock/blog, components/blog, app/(shell)/blog) pro novo
 * repo. Hoje convivem no mesmo bundle pra acelerar o MVP.
 *
 * Quando o backend cair, esses tipos viram o contrato dos
 * endpoints REST /api/admin/blog/* — schemas Zod do servidor
 * devem casar 1:1 com estas interfaces.
 */

import type { ID, ISODate } from './index';

/* ── Categories ───────────────────────────────────────────── */

export interface BlogCategory {
  id: ID;
  /** Display name PT-BR. Ex.: "Tecnologia", "Música ao vivo". */
  name: string;
  /** URL-safe slug. Gerado automaticamente do `name` no create
   *  mas editável manualmente pra preservar URLs após renomeação. */
  slug: string;
  /** Descrição curta opcional, mostrada na listagem pública e
   *  alimenta meta description quando a página é uma listagem
   *  por categoria. */
  description?: string;
  /** Categorias inativas continuam visíveis no admin mas saem do
   *  blog público (filtro WHERE status='active'). Permite arquivar
   *  sem perder histórico. */
  status: 'active' | 'inactive';
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Contador denormalizado de posts ATIVOS na categoria —
   *  hidratado pelo servidor pra evitar JOIN+COUNT em cada
   *  listagem do admin. Recalculado em cada save. */
  postCount: number;
}

/* ── Authors ──────────────────────────────────────────────── */

export interface BlogAuthor {
  id: ID;
  name: string;
  email: string;
  /** URL pública do avatar. Quando o upload de arquivo entrar,
   *  o backend processa o multipart + grava no mesmo storage de
   *  avatars de user já em uso. */
  avatarUrl?: string | null;
  /** Mini bio em texto simples. Mostrada na página do post
   *  (rodapé "Sobre o autor") + em listagens. Limite suave de
   *  ~280 caracteres reforçado no form, hard limit de 1k no
   *  schema do servidor pra resistir a inputs malformados. */
  bio?: string | null;
  /** Slug pra rotas tipo /blog/autor/[slug]. Auto-gerado do nome
   *  no create, editável. */
  slug: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Posts publicados — contador denormalizado. */
  postCount: number;
}

/* ── Tags ─────────────────────────────────────────────────── */

export interface BlogTag {
  id: ID;
  name: string;
  slug: string;
  /** Quantos posts usam essa tag — denormalizado, recalculado
   *  no save de post. Usado pra ordenar dropdowns por
   *  popularidade. */
  postCount: number;
}

/* ── Posts ────────────────────────────────────────────────── */

export type BlogPostStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface BlogPostSEO {
  /** Título usado em <title> + og:title. Cai pro `title` do post
   *  se vazio (pré-preenchido pelo form, sobrescrivível). */
  metaTitle?: string;
  /** Meta description + og:description + Twitter card. Limite
   *  suave de 160 chars no form. */
  metaDescription?: string;
  /** URL canônica explícita — vazio = canonical aponta pra
   *  própria URL do post. Setado em casos de cross-posting. */
  canonicalUrl?: string;
  /** Lista de keywords pra meta keywords (legacy, mas alguns
   *  crawlers de IA ainda leem) + estruturação de schema.org. */
  focusKeywords?: string[];
  /** Override de og:image quando a imagem destaque do post não
   *  serve (ex.: imagem destaque com texto vs. og: limpo). */
  ogImageUrl?: string;
}

export interface BlogPost {
  id: ID;
  title: string;
  /** Subtítulo opcional — render em <p class="lede"> abaixo do
   *  H1 da página pública. Não vira H2, segue como parágrafo
   *  destacado pra não diluir hierarquia de headings (importa
   *  pra SEO). */
  subtitle?: string;
  /** URL-safe slug — chave da URL pública /blog/[slug]. */
  slug: string;
  /** Imagem destaque — URL absoluta. Vira og:image padrão + hero
   *  do post no público. */
  coverImageUrl?: string | null;
  coverImageAlt?: string;
  /** Resumo curto — 1-2 parágrafos. Aparece em listagens e como
   *  fallback de meta description quando seo.metaDescription
   *  estiver vazio. */
  excerpt?: string;
  /** HTML semântico gerado pelo editor rico. Tiptap → HTML.
   *  Sanitizado server-side antes de gravar. Hierarquia de
   *  headings começa em H2 (o H1 é o título do post na página
   *  pública, gerenciado pela rota). */
  bodyHtml: string;
  /** Referências denormalizadas — o save do post resolve ids
   *  pelas tabelas auxiliares e grava o snapshot do nome/avatar
   *  pra que mudanças posteriores no autor/categoria não
   *  reescrevam o conteúdo histórico. */
  authorId: ID;
  authorName: string;
  authorAvatarUrl?: string | null;
  categoryId: ID;
  categoryName: string;
  categorySlug: string;
  /** Tags M2M via blog_post_tags. No payload do GET vem
   *  hidratada como array de objetos pra evitar lookup
   *  extra na UI. */
  tags: BlogTag[];
  status: BlogPostStatus;
  /** Quando `status='scheduled'` o servidor verifica `publishedAt`
   *  vs. NOW() num cron de 1min e flipa pra 'published'. Quando
   *  status já é 'published', `publishedAt` é a data de
   *  publicação efetiva (não muda em saves subsequentes). */
  publishedAt: ISODate | null;
  /** SEO/GEO — agrupado num sub-objeto pra UI poder renderizar
   *  uma seção "SEO avançado" colapsável sem desorganizar o
   *  resto do form. */
  seo: BlogPostSEO;
  createdAt: ISODate;
  updatedAt: ISODate;
  /** Contador de revisões — incrementa a cada save. Quando o
   *  histórico de revisões (drafts versionados) for implementado,
   *  esse campo casa com a quantidade de linhas em
   *  blog_post_revisions. */
  revisionCount: number;
  /** Tempo de leitura estimado (minutos), calculado server-side
   *  no save baseado em palavras/200wpm. Exposto na UI pública. */
  readingTimeMinutes: number;
}

/** Payload de criação — `id`, timestamps e contadores são
 *  preenchidos pelo servidor. Os campos `*Name` denormalizados
 *  vêm vazios e são hidratados via lookup dos `*Id`. */
export type BlogPostCreateInput = Omit<
  BlogPost,
  | 'id'
  | 'authorName'
  | 'authorAvatarUrl'
  | 'categoryName'
  | 'categorySlug'
  | 'tags'
  | 'createdAt'
  | 'updatedAt'
  | 'revisionCount'
  | 'readingTimeMinutes'
> & {
  /** ids das tags — o servidor resolve nome/slug. */
  tagIds: ID[];
};

export type BlogPostUpdateInput = Partial<BlogPostCreateInput> & {
  id: ID;
};

/* ── List filters ────────────────────────────────────────── */

export interface BlogPostListFilters {
  search?: string;
  status?: BlogPostStatus | 'all';
  categoryId?: ID | 'all';
  authorId?: ID | 'all';
  /** Ordenação. Default: publishedAt desc (mais recentes
   *  primeiro). */
  sort?: 'publishedAt-desc' | 'publishedAt-asc' | 'title-asc' | 'updatedAt-desc';
}
