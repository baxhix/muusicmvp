import { api } from './api';
import type { User } from '@/types';

export const usersService = {
  list:   () => api.get<User[]>('/users'),
  get:    (id: string) => api.get<User>(`/users/${id}`),
  create: (data: Partial<User>) => api.post<User>('/users', data),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
  remove: (id: string) => api.delete<void>(`/users/${id}`),
  suspend: (id: string) => api.post<User>(`/users/${id}/suspend`),
  ban:     (id: string) => api.post<User>(`/users/${id}/ban`),
  reactivate: (id: string) => api.post<User>(`/users/${id}/reactivate`),
};
