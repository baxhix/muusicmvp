import type { BlogCategory } from '@/types/blog';
import { slugify, ensureUniqueSlug } from '@/lib/blog/slug';
import { getBlogStore, newId, setCategories } from './store';

/**
 * Service de categorias do blog.
 *
 * Hoje toca o in-memory store (services/blog/store.ts). Quando o
 * backend cair, esse arquivo vira o adapter HTTP — assinaturas
 * públicas das funções (list/create/update/remove) ficam iguais
 * e os componentes não mudam.
 */

export interface ListCategoriesOptions {
  search?: string;
  /** Filtro do status. Default: 'all' (mostra ativas + inativas). */
  status?: 'active' | 'inactive' | 'all';
  /** Limite + offset pra paginação client-side. */
  limit?: number;
  offset?: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
}

export const blogCategoriesService = {
  async list(opts: ListCategoriesOptions = {}): Promise<ListResult<BlogCategory>> {
    const store = getBlogStore();
    const q = opts.search?.trim().toLowerCase() ?? '';
    let rows = store.categories;
    if (opts.status && opts.status !== 'all') {
      rows = rows.filter((c) => c.status === opts.status);
    }
    if (q) {
      rows = rows.filter((c) =>
        [c.name, c.slug, c.description ?? '']
          .some((field) => field.toLowerCase().includes(q)),
      );
    }
    const total = rows.length;
    const start = opts.offset ?? 0;
    const end = opts.limit != null ? start + opts.limit : undefined;
    return { items: rows.slice(start, end), total };
  },

  async get(id: string): Promise<BlogCategory | null> {
    const store = getBlogStore();
    return store.categories.find((c) => c.id === id) ?? null;
  },

  async create(input: {
    name: string;
    slug?: string;
    description?: string;
    status?: 'active' | 'inactive';
  }): Promise<BlogCategory> {
    const store = getBlogStore();
    const desiredSlug = (input.slug?.trim() || slugify(input.name)).trim();
    const slug = ensureUniqueSlug(
      desiredSlug,
      store.categories.map((c) => c.slug),
    );
    const now = new Date().toISOString();
    const row: BlogCategory = {
      id: newId('cat'),
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || undefined,
      status: input.status ?? 'active',
      createdAt: now,
      updatedAt: now,
      postCount: 0,
    };
    setCategories([...store.categories, row]);
    return row;
  },

  async update(
    id: string,
    patch: Partial<{
      name: string;
      slug: string;
      description: string;
      status: 'active' | 'inactive';
    }>,
  ): Promise<BlogCategory> {
    const store = getBlogStore();
    const current = store.categories.find((c) => c.id === id);
    if (!current) throw new Error('not_found');

    // Se o slug foi explicitamente passado, valida unicidade
    // contra as outras categorias. Slug ausente no patch =
    // mantém o atual.
    let nextSlug = current.slug;
    if (patch.slug !== undefined) {
      const desired = (patch.slug.trim() || slugify(patch.name ?? current.name)).trim();
      nextSlug = ensureUniqueSlug(
        desired,
        store.categories.filter((c) => c.id !== id).map((c) => c.slug),
      );
    }

    const next: BlogCategory = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      slug: nextSlug,
      ...(patch.description !== undefined
        ? { description: patch.description.trim() || undefined }
        : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      updatedAt: new Date().toISOString(),
    };
    setCategories(store.categories.map((c) => (c.id === id ? next : c)));
    return next;
  },

  async remove(id: string): Promise<void> {
    const store = getBlogStore();
    setCategories(store.categories.filter((c) => c.id !== id));
  },
};
