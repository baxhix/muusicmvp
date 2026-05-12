import { api } from './api';
import type { User } from '@/types';

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
  remove: (id: string) => api.delete<void>(`/users/${id}`),
  suspend: (id: string) => api.post<User>(`/users/${id}/suspend`),
  ban:     (id: string) => api.post<User>(`/users/${id}/ban`),
  reactivate: (id: string) => api.post<User>(`/users/${id}/reactivate`),
};
