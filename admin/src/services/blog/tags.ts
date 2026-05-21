import type { BlogTag } from '@/types/blog';
import { ensureUniqueSlug, slugify } from '@/lib/blog/slug';
import { getBlogStore, newId, setTags } from './store';

/** Service de tags. Tags são "leve" no admin — sem CRUD próprio,
 *  são criadas inline pelo editor de post (TagsField) digitando
 *  novos labels. Aqui ficam os helpers que ele consome. */
export const blogTagsService = {
  async list(): Promise<BlogTag[]> {
    const store = getBlogStore();
    return [...store.tags].sort((a, b) => b.postCount - a.postCount);
  },

  /** Upsert pelo slug. Se já existe, devolve a linha existente;
   *  senão cria. Usado pelo TagsField quando o usuário digita
   *  uma tag nova. */
  async ensure(name: string): Promise<BlogTag> {
    const store = getBlogStore();
    const slug = ensureUniqueSlug(slugify(name), store.tags.map((t) => t.slug));
    const existing = store.tags.find((t) => t.slug === slug);
    if (existing) return existing;
    const row: BlogTag = {
      id: newId('tag'),
      name: name.trim(),
      slug,
      postCount: 0,
    };
    setTags([...store.tags, row]);
    return row;
  },
};
