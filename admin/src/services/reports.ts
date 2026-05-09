import { api } from './api';
import type { Report } from '@/types';

export const reportsService = {
  list:    () => api.get<Report[]>('/reports'),
  get:     (id: string) => api.get<Report>(`/reports/${id}`),
  resolve: (id: string)  => api.post<Report>(`/reports/${id}/resolve`),
  dismiss: (id: string)  => api.post<Report>(`/reports/${id}/dismiss`),
  escalate: (id: string) => api.post<Report>(`/reports/${id}/escalate`),
};
