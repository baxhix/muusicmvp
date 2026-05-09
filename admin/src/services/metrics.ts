import { api } from './api';
import type { ChartSeries, Kpi, ActivityEntry } from '@/types';

export const metricsService = {
  kpis:               () => api.get<Kpi[]>('/metrics/kpis'),
  growth:             () => api.get<ChartSeries[]>('/metrics/growth'),
  revenue:            () => api.get<ChartSeries[]>('/metrics/revenue'),
  postsByType:        () => api.get<{ label: string; value: number }[]>('/metrics/posts-by-type'),
  planDistribution:   () => api.get<{ label: string; value: number; color: string }[]>('/metrics/plan-distribution'),
  reportsByReason:    () => api.get<{ label: string; value: number; color: string }[]>('/metrics/reports-by-reason'),
  activity:           () => api.get<ActivityEntry[]>('/activity'),
};
