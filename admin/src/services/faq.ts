import { api } from './api';

/**
 * FAQ admin service — CRUD wrapper sobre `/api/admin/faq/*`.
 *
 * O backend retorna entradas (rascunhos + publicadas) ordenadas por
 * `sortOrder` asc. UI mostra ambos os estados; o site público
 * consome um endpoint separado (`/api/faq`) que já filtra
 * rascunhos.
 */

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  /** ISO timestamp; null = rascunho (não aparece no site público). */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFaqInput {
  question: string;
  answer: string;
  category?: string | null;
  publish?: boolean;
}

export interface UpdateFaqInput {
  question?: string;
  answer?: string;
  category?: string | null;
  publish?: boolean;
}

export const faqService = {
  list: () =>
    api.get<{ items: FaqEntry[] }>('/api/admin/faq'),

  create: (input: CreateFaqInput) =>
    api.post<{ entry: FaqEntry }>('/api/admin/faq', input),

  update: (id: string, input: UpdateFaqInput) =>
    api.patch<{ entry: FaqEntry }>(`/api/admin/faq/${id}`, input),

  remove: (id: string) =>
    api.delete<{ ok: true }>(`/api/admin/faq/${id}`),

  /** Recebe a lista completa de ids na ordem desejada. */
  reorder: (ids: string[]) =>
    api.post<{ ok: true }>('/api/admin/faq/reorder', { ids }),
};
