/**
 * Blog — contratos de domínio do FRONTEND PÚBLICO.
 *
 * Sub-set do que o admin trabalha: aqui só interessa o que é
 * exibido pra leitores (status sempre = 'published', sem
 * revisionCount nem campos editoriais). Quando o backend cair,
 * o GET /api/blog/posts retornará exatamente esse shape (o
 * mesmo endpoint que o admin chama com filtros adicionais).
 */

export type BlogTag = {
  id: string;
  name: string;
  slug: string;
};

export type BlogAuthorPreview = {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type BlogCategoryPreview = {
  id: string;
  name: string;
  slug: string;
};

export interface BlogPostSEO {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  focusKeywords?: string[];
  ogImageUrl?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  coverImageUrl?: string | null;
  coverImageAlt?: string;
  excerpt?: string;
  /** HTML semântico (já sanitizado pelo servidor). */
  bodyHtml: string;
  /** Snapshots — não mudam se autor/categoria for editado. */
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  authorSlug: string;
  authorBio?: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  tags: BlogTag[];
  /** ISO. Garantido pra posts publicados. */
  publishedAt: string;
  seo: BlogPostSEO;
  readingTimeMinutes: number;
}

/** Helper pra listagens. */
export interface BlogPostListItem
  extends Pick<
    BlogPost,
    | 'id'
    | 'title'
    | 'subtitle'
    | 'slug'
    | 'coverImageUrl'
    | 'coverImageAlt'
    | 'excerpt'
    | 'authorName'
    | 'authorAvatarUrl'
    | 'authorSlug'
    | 'categoryName'
    | 'categorySlug'
    | 'publishedAt'
    | 'readingTimeMinutes'
  > {
  /** Tags primeiras 3 (overflow vira "+N"). */
  topTags?: BlogTag[];
}
