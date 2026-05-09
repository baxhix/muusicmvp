import { api } from './api';
import type { TeamMember } from '@/types';

export const teamService = {
  list:   () => api.get<TeamMember[]>('/settings/team'),
  invite: (data: Pick<TeamMember, 'email' | 'role'>) =>
    api.post<TeamMember>('/settings/team', data),
  remove: (id: string) => api.delete<void>(`/settings/team/${id}`),
  updateRole: (id: string, role: TeamMember['role']) =>
    api.patch<TeamMember>(`/settings/team/${id}`, { role }),
};
