import { api } from './api';

/**
 * Shape of an admin track row. Mirrors AdminTrackRow on the server
 * (src/server/tracks/queries.ts). Kept narrow so the admin doesn't
 * need to import server types.
 */
export interface AdminTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  year: number;
  youtubeId: string;
  createdAt: string;
}

export interface CreateTrackInput {
  url: string;
  title: string;
  artist: string;
  album?: string;
}

interface CreateResponse {
  track: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    youtubeId: string;
    createdAt: string;
  };
  created: boolean;
}

/**
 * Admin tracks CRUD. All paths under /api/admin/* — automatically
 * routed to the real backend by the per-path driver picker in
 * services/api.ts.
 */
export const tracksService = {
  list: () => api.get<AdminTrack[]>('/api/admin/tracks'),
  create: (input: CreateTrackInput) =>
    api.post<CreateResponse>('/api/admin/tracks', input),
  remove: (id: string) => api.delete<{ ok: boolean }>(`/api/admin/tracks/${id}`),
};
