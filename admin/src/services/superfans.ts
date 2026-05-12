import { api } from './api';
import type { Superfan } from '@/types';

/**
 * Real Superfãs list — the backend already maps each row to the
 * exact Superfan shape (identity + fanpoints + interaction counts +
 * days-active), so the admin gets a ready-to-render array with no
 * client-side transformation.
 *
 * The per-id detail getter still routes to the mock driver since
 * there's no single-user breakdown endpoint yet. When detail views
 * grow real data, swap this path to /api/admin/superfans/${id}.
 */
export const superfansService = {
  list: () => api.get<Superfan[]>('/api/admin/superfans'),
  get:  (id: string) => api.get<Superfan>(`/superfans/${id}`),
};
