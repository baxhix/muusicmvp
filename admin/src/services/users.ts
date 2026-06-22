import { api } from './api';
import type { User, UserActivityEvent } from '@/types';

/**
 * Users service. `list()` calls the real backend at /api/admin/users —
 * shape matches the admin User type 1:1 because the server already
 * maps the DB row into the table's expected fields, filling sensible
 * defaults for properties the backend doesn't track yet (age, sex,
 * plan, etc.). When more fields land in the DB the server stops
 * defaulting and the admin picks them up without any code change.
 *
 * The other operations (get/create/update/remove/suspend/ban) still
 * fall back to the mock driver because the matching backend endpoints
 * don't exist yet — keeps the rest of the UI usable end-to-end.
 */
export const usersService = {
  list:   () => api.get<User[]>('/api/admin/users'),
  get:    (id: string) => api.get<User>(`/users/${id}`),
  create: (data: Partial<User>) => api.post<User>('/users', data),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
  /**
   * Soft delete via backend real — marca `deleted_at` + revoga sessões.
   * O usuário some da listagem do admin imediatamente porque
   * `listAllUsers` filtra `deleted_at IS NULL`. Backend:
   * DELETE /api/admin/users/:id (LGPD: row preservada por retenção,
   * cron anonimiza PII depois). */
  remove: (id: string) =>
    api.delete<{ ok: boolean; marked: boolean; sessionsRevoked: number }>(
      `/api/admin/users/${id}`,
    ),
  suspend: (id: string) => api.post<User>(`/users/${id}/suspend`),
  ban:     (id: string) => api.post<User>(`/users/${id}/ban`),
  reactivate: (id: string) => api.post<User>(`/users/${id}/reactivate`),
  /**
   * Real audit feed for a single user. Backed by
   * `/api/admin/users/:id/activities` on the muusic backend
   * (see src/app/api/admin/users/[id]/activities/route.ts) —
   * pipes the `user_activities` ledger through a mapper that
   * shapes each row into `UserActivityEvent`. Music plays
   * (kind=`stream`) show up here as `category: 'streaming',
   * action: 'track_played'` rows so the audit doubles as a
   * listening log. Per product feedback "salve no admin junto
   * das atividades do usuário".
   *
   * "Ver atividades completas" deve listar TUDO desde o cadastro,
   * então paginamos o cursor `before` (created_at) em blocos de 200
   * até o backend dizer `hasMore: false`. O safety cap de 100 páginas
   * (20.000 eventos) só existe pra blindar contra loop infinito —
   * está muito acima de qualquer histórico real.
   */
  activities: async (id: string): Promise<{ events: UserActivityEvent[] }> => {
    const PAGE = 200;
    const MAX_PAGES = 100;
    const all: UserActivityEvent[] = [];
    let before: string | undefined;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const qs = new URLSearchParams({ limit: String(PAGE) });
      if (before) qs.set('before', before);
      const res = await api.get<{ events: UserActivityEvent[]; hasMore?: boolean }>(
        `/api/admin/users/${id}/activities?${qs.toString()}`,
      );

      const events = res?.events ?? [];
      all.push(...events);

      // Cursor = timestamp do evento mais antigo desta página (a lista
      // vem ordenada do mais novo pro mais antigo).
      const oldest = events[events.length - 1];
      if (!res?.hasMore || events.length === 0 || !oldest?.timestamp) break;
      before = oldest.timestamp;
    }

    return { events: all };
  },
};
