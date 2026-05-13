import { api } from './api';
import type { Report } from '@/types';

/**
 * Reports service. The `list` call has been promoted from mock to
 * the real `/api/admin/reports` endpoint on the muusic web app —
 * any report submitted from the chat kebab menu shows up here. The
 * resolve/dismiss/escalate routes are still mock-backed until the
 * matching admin actions exist server-side.
 */
export const reportsService = {
  list:     () => api.get<Report[]>('/api/admin/reports'),
  get:      (id: string)  => api.get<Report>(`/reports/${id}`),
  resolve:  (id: string)  => api.post<Report>(`/reports/${id}/resolve`),
  dismiss:  (id: string)  => api.post<Report>(`/reports/${id}/dismiss`),
  escalate: (id: string)  => api.post<Report>(`/reports/${id}/escalate`),
};
