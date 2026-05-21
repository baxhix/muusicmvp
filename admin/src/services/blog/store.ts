/**
 * In-memory store que simula a persistência do blog enquanto o
 * backend real não cair. Pega as listas dos mocks no boot e
 * suporta operações de mutação (create/update/delete) que
 * sobrevivem durante a sessão.
 *
 * Único ponto a tocar no dia da migração pra HTTP: trocar as
 * funções do store por fetch ao endpoint REST correspondente —
 * services/blog/{categories,authors,posts,tags}.ts continuam
 * com a mesma API pública pra cima.
 *
 * Não usa Zustand/Redux propositalmente: nenhum componente lê
 * direto do store. Tudo passa pelas funções dos services, que
 * eventualmente viram fetch.
 */

import { loadMockBlogAuthors } from '@/data/mock/blog/authors';
import { loadMockBlogCategories } from '@/data/mock/blog/categories';
import { loadMockBlogPosts } from '@/data/mock/blog/posts';
import { loadMockBlogTags } from '@/data/mock/blog/tags';
import type {
  BlogAuthor,
  BlogCategory,
  BlogPost,
  BlogTag,
} from '@/types/blog';

interface BlogStore {
  categories: BlogCategory[];
  authors: BlogAuthor[];
  posts: BlogPost[];
  tags: BlogTag[];
}

let _store: BlogStore | null = null;

function ensureStore(): BlogStore {
  if (_store) return _store;
  _store = {
    categories: loadMockBlogCategories(),
    authors: loadMockBlogAuthors(),
    posts: loadMockBlogPosts(),
    tags: loadMockBlogTags(),
  };
  return _store;
}

/** Acesso somente leitura — usado pelos services. Devolve a
 *  referência (não clone) pra que mutações via setters sejam
 *  visíveis aos próximos lookups. */
export function getBlogStore(): BlogStore {
  return ensureStore();
}

/** Replace de coleção. Usado nos services depois de cada
 *  mutação. Force um clone do array pra simular a semântica
 *  imutável dos endpoints REST (cada GET devolve uma lista
 *  recém-construída). */
export function setCategories(rows: BlogCategory[]): void {
  ensureStore().categories = rows;
}
export function setAuthors(rows: BlogAuthor[]): void {
  ensureStore().authors = rows;
}
export function setPosts(rows: BlogPost[]): void {
  ensureStore().posts = rows;
}
export function setTags(rows: BlogTag[]): void {
  ensureStore().tags = rows;
}

/** Gera ids estáveis pra inserts. Em produção o servidor gera
 *  uuid; aqui usamos prefixo + timestamp pra ser previsível
 *  durante o debug. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}
