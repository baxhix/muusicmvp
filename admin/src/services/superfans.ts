import { api } from './api';
import type { Superfan } from '@/types';

export const superfansService = {
  list: () => api.get<Superfan[]>('/superfans'),
  get:  (id: string) => api.get<Superfan>(`/superfans/${id}`),
};
