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
   */
  activities: (id: string) =>
    api.get<{ events: UserActivityEvent[] }>(`/api/admin/users/${id}/activities`),
};
