import { api } from './api';
import type { Integration } from '@/types';

export const integrationsService = {
  list:       () => api.get<Integration[]>('/settings/integrations'),
  connect:    (id: string) => api.post<Integration>(`/settings/integrations/${id}/connect`),
  disconnect: (id: string) => api.post<Integration>(`/settings/integrations/${id}/disconnect`),
};
