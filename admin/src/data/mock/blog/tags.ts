import type { BlogTag } from '@/types/blog';

/** Tags do blog — vocabulary controlado dos posts. Cresce
 *  organicamente conforme posts forem criados; ao salvar um
 *  post no editor, tags novas digitadas no campo viram linhas
 *  aqui (server-side faz upsert pelo slug). */
export const MOCK_BLOG_TAGS: BlogTag[] = [
  { id: 'tag-ana-castela', name: 'Ana Castela', slug: 'ana-castela', postCount: 18 },
  { id: 'tag-boiadeira', name: 'Boiadeira', slug: 'boiadeira', postCount: 9 },
  { id: 'tag-sertanejo', name: 'Sertanejo', slug: 'sertanejo', postCount: 12 },
  { id: 'tag-festival', name: 'Festival', slug: 'festival', postCount: 4 },
  { id: 'tag-turne-internacional', name: 'Turnê Internacional', slug: 'turne-internacional', postCount: 3 },
  { id: 'tag-bastidores', name: 'Bastidores', slug: 'bastidores', postCount: 6 },
  { id: 'tag-entrevista', name: 'Entrevista', slug: 'entrevista', postCount: 5 },
  { id: 'tag-lancamento', name: 'Lançamento', slug: 'lancamento', postCount: 8 },
  { id: 'tag-pre-save', name: 'Pré-save', slug: 'pre-save', postCount: 2 },
  { id: 'tag-cultura-pop', name: 'Cultura Pop', slug: 'cultura-pop', postCount: 7 },
];

export function loadMockBlogTags(): BlogTag[] {
  return [...MOCK_BLOG_TAGS];
}
