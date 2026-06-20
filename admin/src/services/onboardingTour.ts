import { api } from './api';

/**
 * Onboarding tour admin service — CRUD wrapper sobre
 * `/api/admin/onboarding-tour/*`. Gerencia os cards do tour de
 * orientação in-app (deck mostrado ao usuário no /app).
 *
 * O backend retorna todos os cards (rascunhos + publicados)
 * ordenados por `sortOrder` asc. O app consome um endpoint público
 * separado (`/api/onboarding-tour`) que já filtra rascunhos.
 */

export interface OnboardingCard {
  id: string;
  emoji: string | null;
  title: string;
  body: string;
  cta: string;
  /** 'globe' liga a decoração de bolhas; null = sem decoração. */
  decor: string | null;
  /** Reservado — chave de spotlight ancorado (Fase futura). */
  anchor: string | null;
  sortOrder: number;
  /** ISO timestamp; null = rascunho (não aparece pro usuário). */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOnboardingCardInput {
  emoji?: string | null;
  title: string;
  body: string;
  cta: string;
  decor?: 'globe' | null;
  anchor?: string | null;
  publish?: boolean;
}

export interface UpdateOnboardingCardInput {
  emoji?: string | null;
  title?: string;
  body?: string;
  cta?: string;
  decor?: 'globe' | null;
  anchor?: string | null;
  publish?: boolean;
}

export const onboardingTourService = {
  list: () =>
    api.get<{ items: OnboardingCard[] }>('/api/admin/onboarding-tour'),

  create: (input: CreateOnboardingCardInput) =>
    api.post<{ entry: OnboardingCard }>('/api/admin/onboarding-tour', input),

  update: (id: string, input: UpdateOnboardingCardInput) =>
    api.patch<{ entry: OnboardingCard }>(`/api/admin/onboarding-tour/${id}`, input),

  remove: (id: string) =>
    api.delete<{ ok: true }>(`/api/admin/onboarding-tour/${id}`),

  /** Recebe a lista completa de ids na ordem desejada. */
  reorder: (ids: string[]) =>
    api.post<{ ok: true }>('/api/admin/onboarding-tour/reorder', { ids }),
};
