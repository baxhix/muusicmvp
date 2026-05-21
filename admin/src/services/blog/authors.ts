import type { BlogAuthor } from '@/types/blog';
import { ensureUniqueSlug, slugify } from '@/lib/blog/slug';
import { getBlogStore, newId, setAuthors } from './store';
import type { ListResult } from './categories';

export interface ListAuthorsOptions {
  search?: string;
  limit?: number;
  offset?: number;
}

export const blogAuthorsService = {
  async list(opts: ListAuthorsOptions = {}): Promise<ListResult<BlogAuthor>> {
    const store = getBlogStore();
    const q = opts.search?.trim().toLowerCase() ?? '';
    let rows = store.authors;
    if (q) {
      rows = rows.filter((u) =>
        [u.name, u.email, u.bio ?? '']
          .some((f) => f.toLowerCase().includes(q)),
      );
    }
    const total = rows.length;
    const start = opts.offset ?? 0;
    const end = opts.limit != null ? start + opts.limit : undefined;
    return { items: rows.slice(start, end), total };
  },

  async get(id: string): Promise<BlogAuthor | null> {
    const store = getBlogStore();
    return store.authors.find((u) => u.id === id) ?? null;
  },

  async create(input: {
    name: string;
    email: string;
    avatarUrl?: string | null;
    bio?: string | null;
    slug?: string;
  }): Promise<BlogAuthor> {
    const store = getBlogStore();
    const desired = (input.slug?.trim() || slugify(input.name)).trim();
    const slug = ensureUniqueSlug(
      desired,
      store.authors.map((u) => u.slug),
    );
    const now = new Date().toISOString();
    const row: BlogAuthor = {
      id: newId('aut'),
      name: input.name.trim(),
      email: input.email.trim(),
      avatarUrl: input.avatarUrl ?? null,
      bio: input.bio ?? null,
      slug,
      createdAt: now,
      updatedAt: now,
      postCount: 0,
    };
    setAuthors([...store.authors, row]);
    return row;
  },

  async update(
    id: string,
    patch: Partial<{
      name: string;
      email: string;
      avatarUrl: string | null;
      bio: string | null;
      slug: string;
    }>,
  ): Promise<BlogAuthor> {
    const store = getBlogStore();
    const current = store.authors.find((u) => u.id === id);
    if (!current) throw new Error('not_found');

    let nextSlug = current.slug;
    if (patch.slug !== undefined) {
      const desired = (patch.slug.trim() || slugify(patch.name ?? current.name)).trim();
      nextSlug = ensureUniqueSlug(
        desired,
        store.authors.filter((u) => u.id !== id).map((u) => u.slug),
      );
    }

    const next: BlogAuthor = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
      ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      slug: nextSlug,
      updatedAt: new Date().toISOString(),
    };
    setAuthors(store.authors.map((u) => (u.id === id ? next : u)));
    return next;
  },

  async remove(id: string): Promise<void> {
    const store = getBlogStore();
    setAuthors(store.authors.filter((u) => u.id !== id));
  },
};
