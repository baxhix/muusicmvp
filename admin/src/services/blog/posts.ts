import type {
  BlogPost,
  BlogPostCreateInput,
  BlogPostListFilters,
  BlogPostStatus,
  BlogPostUpdateInput,
  BlogTag,
} from '@/types/blog';
import { ensureUniqueSlug, slugify } from '@/lib/blog/slug';
import { getBlogStore, newId, setPosts, setTags } from './store';
import type { ListResult } from './categories';

/** Calcula tempo de leitura em minutos a partir do HTML do post.
 *  Heurística: ~200 palavras por minuto (média de leitura confortável
 *  em PT-BR). Strip de tags antes de contar palavras. Mínimo 1 min. */
function readingTimeForHtml(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Resolve ids de tags pro array de BlogTag completo, criando
 *  novas tags pelas labels que não existem ainda. O input do
 *  editor permite digitar livre + criar on-the-fly. */
function resolveTagIds(tagIds: string[]): BlogTag[] {
  const store = getBlogStore();
  return tagIds
    .map((id) => store.tags.find((t) => t.id === id))
    .filter((t): t is BlogTag => Boolean(t));
}

export interface ListPostsOptions extends BlogPostListFilters {
  limit?: number;
  offset?: number;
}

export const blogPostsService = {
  async list(opts: ListPostsOptions = {}): Promise<ListResult<BlogPost>> {
    const store = getBlogStore();
    const q = opts.search?.trim().toLowerCase() ?? '';
    let rows = store.posts;

    if (opts.status && opts.status !== 'all') {
      rows = rows.filter((p) => p.status === opts.status);
    }
    if (opts.categoryId && opts.categoryId !== 'all') {
      rows = rows.filter((p) => p.categoryId === opts.categoryId);
    }
    if (opts.authorId && opts.authorId !== 'all') {
      rows = rows.filter((p) => p.authorId === opts.authorId);
    }
    if (q) {
      rows = rows.filter((p) =>
        [p.title, p.subtitle ?? '', p.excerpt ?? '', p.authorName, p.categoryName]
          .some((field) => field.toLowerCase().includes(q)),
      );
    }

    // Ordenação. publishedAt-desc é o default — não-publicados (null)
    // sobem como mais recentes (em edição) pra ficar visíveis.
    const sort = opts.sort ?? 'publishedAt-desc';
    rows = [...rows].sort((a, b) => {
      const order = (ts: string | null) =>
        ts ? new Date(ts).getTime() : Number.MAX_SAFE_INTEGER;
      switch (sort) {
        case 'publishedAt-asc':
          return order(a.publishedAt) - order(b.publishedAt);
        case 'publishedAt-desc':
          return order(b.publishedAt) - order(a.publishedAt);
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'updatedAt-desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

    const total = rows.length;
    const start = opts.offset ?? 0;
    const end = opts.limit != null ? start + opts.limit : undefined;
    return { items: rows.slice(start, end), total };
  },

  async get(id: string): Promise<BlogPost | null> {
    const store = getBlogStore();
    return store.posts.find((p) => p.id === id) ?? null;
  },

  async create(input: BlogPostCreateInput): Promise<BlogPost> {
    const store = getBlogStore();
    const author = store.authors.find((a) => a.id === input.authorId);
    const category = store.categories.find((c) => c.id === input.categoryId);
    if (!author) throw new Error('author_not_found');
    if (!category) throw new Error('category_not_found');

    const desired = (input.slug?.trim() || slugify(input.title)).trim();
    const slug = ensureUniqueSlug(desired, store.posts.map((p) => p.slug));

    const now = new Date().toISOString();
    const row: BlogPost = {
      id: newId('post'),
      title: input.title.trim(),
      subtitle: input.subtitle?.trim() || undefined,
      slug,
      coverImageUrl: input.coverImageUrl ?? null,
      coverImageAlt: input.coverImageAlt?.trim() || undefined,
      excerpt: input.excerpt?.trim() || undefined,
      bodyHtml: input.bodyHtml ?? '',
      authorId: author.id,
      authorName: author.name,
      authorAvatarUrl: author.avatarUrl,
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      tags: resolveTagIds(input.tagIds ?? []),
      status: input.status,
      publishedAt: input.publishedAt,
      seo: input.seo ?? {},
      createdAt: now,
      updatedAt: now,
      revisionCount: 1,
      readingTimeMinutes: readingTimeForHtml(input.bodyHtml ?? ''),
    };
    setPosts([...store.posts, row]);
    return row;
  },

  async update(input: BlogPostUpdateInput): Promise<BlogPost> {
    const store = getBlogStore();
    const current = store.posts.find((p) => p.id === input.id);
    if (!current) throw new Error('not_found');

    let nextSlug = current.slug;
    if (input.slug !== undefined) {
      const desired = (input.slug.trim() || slugify(input.title ?? current.title)).trim();
      nextSlug = ensureUniqueSlug(
        desired,
        store.posts.filter((p) => p.id !== current.id).map((p) => p.slug),
      );
    }

    let nextAuthor = {
      id: current.authorId,
      name: current.authorName,
      avatarUrl: current.authorAvatarUrl,
    };
    if (input.authorId !== undefined && input.authorId !== current.authorId) {
      const author = store.authors.find((a) => a.id === input.authorId);
      if (!author) throw new Error('author_not_found');
      nextAuthor = { id: author.id, name: author.name, avatarUrl: author.avatarUrl ?? null };
    }

    let nextCategory = {
      id: current.categoryId,
      name: current.categoryName,
      slug: current.categorySlug,
    };
    if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
      const category = store.categories.find((c) => c.id === input.categoryId);
      if (!category) throw new Error('category_not_found');
      nextCategory = { id: category.id, name: category.name, slug: category.slug };
    }

    const nextBodyHtml = input.bodyHtml ?? current.bodyHtml;
    const next: BlogPost = {
      ...current,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.subtitle !== undefined
        ? { subtitle: input.subtitle.trim() || undefined }
        : {}),
      slug: nextSlug,
      ...(input.coverImageUrl !== undefined
        ? { coverImageUrl: input.coverImageUrl }
        : {}),
      ...(input.coverImageAlt !== undefined
        ? { coverImageAlt: input.coverImageAlt.trim() || undefined }
        : {}),
      ...(input.excerpt !== undefined
        ? { excerpt: input.excerpt.trim() || undefined }
        : {}),
      bodyHtml: nextBodyHtml,
      authorId: nextAuthor.id,
      authorName: nextAuthor.name,
      authorAvatarUrl: nextAuthor.avatarUrl,
      categoryId: nextCategory.id,
      categoryName: nextCategory.name,
      categorySlug: nextCategory.slug,
      tags:
        input.tagIds !== undefined ? resolveTagIds(input.tagIds) : current.tags,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.publishedAt !== undefined
        ? { publishedAt: input.publishedAt }
        : {}),
      ...(input.seo !== undefined ? { seo: input.seo } : {}),
      updatedAt: new Date().toISOString(),
      revisionCount: current.revisionCount + 1,
      readingTimeMinutes: readingTimeForHtml(nextBodyHtml),
    };
    setPosts(store.posts.map((p) => (p.id === current.id ? next : p)));
    return next;
  },

  /** Atalho de troca de status. Útil pra ações rápidas de "publicar"
   *  ou "despublicar" na listagem sem abrir o editor inteiro. */
  async setStatus(id: string, status: BlogPostStatus): Promise<BlogPost> {
    const publishedAt =
      status === 'published' ? new Date().toISOString() : null;
    return blogPostsService.update({ id, status, publishedAt });
  },

  /** Duplica um post — útil pra reutilizar estrutura de um post
   *  publicado num próximo draft (ex.: "guia mensal de shows"
   *  copia o anterior + edita). */
  async duplicate(id: string): Promise<BlogPost> {
    const store = getBlogStore();
    const src = store.posts.find((p) => p.id === id);
    if (!src) throw new Error('not_found');
    return blogPostsService.create({
      title: `${src.title} (cópia)`,
      subtitle: src.subtitle,
      slug: '', // força regeração via slugify(title)
      coverImageUrl: src.coverImageUrl,
      coverImageAlt: src.coverImageAlt,
      excerpt: src.excerpt,
      bodyHtml: src.bodyHtml,
      authorId: src.authorId,
      categoryId: src.categoryId,
      tagIds: src.tags.map((t) => t.id),
      status: 'draft',
      publishedAt: null,
      seo: { ...src.seo },
    });
  },

  async remove(id: string): Promise<void> {
    const store = getBlogStore();
    setPosts(store.posts.filter((p) => p.id !== id));
  },
};
