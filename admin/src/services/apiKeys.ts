import { api } from './api';
import type { ApiKey } from '@/types';

export const apiKeysService = {
  list:   () => api.get<ApiKey[]>('/settings/api-keys'),
  create: (data: Pick<ApiKey, 'label' | 'scopes'>) =>
    api.post<ApiKey>('/settings/api-keys', data),
  revoke: (id: string) => api.delete<void>(`/settings/api-keys/${id}`),
};
