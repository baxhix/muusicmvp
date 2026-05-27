import { api } from './api';

export interface AdminArtistLink {
  id: string;
  slug: string;
  artistName: string;
  label: string | null;
  createdAt: string;
  createdBy: string | null;
  archivedAt: string | null;
  /** Signups atribuídos a este link. */
  signupCount: number;
}

export interface CreateArtistLinkInput {
  slug: string;
  artistName: string;
  label?: string | null;
}

export interface LinkUserRow {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string;
  isOnboarded: boolean;
}

export const acquisitionService = {
  list: () =>
    api.get<{ items: AdminArtistLink[] }>('/api/admin/acquisition/links'),
  create: (input: CreateArtistLinkInput) =>
    api.post<{ link: AdminArtistLink }>('/api/admin/acquisition/links', input),
  /** Soft-delete (archive) — links arquivados não recebem
   *  NOVOS signups via /r/[slug] mas histórico permanece. */
  archive: (id: string) =>
    api.delete<{ ok: boolean; archivedId: string }>(
      `/api/admin/acquisition/links/${id}`,
    ),
  detail: (id: string) =>
    api.get<{ link: AdminArtistLink }>(
      `/api/admin/acquisition/links/${id}`,
    ),
  users: (id: string, opts: { limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.limit !== undefined) qs.set('limit', String(opts.limit));
    if (opts.offset !== undefined) qs.set('offset', String(opts.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ items: LinkUserRow[]; total: number }>(
      `/api/admin/acquisition/links/${id}/users${suffix}`,
    );
  },
};

/** Constrói a URL pública compartilhável do link. Usa o origin
 *  do window quando rodando client-side; fallback pra muusic.live
 *  pra SSR. */
export function buildShareableUrl(slug: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/r/${slug}`;
  }
  return `https://muusic.live/r/${slug}`;
}
