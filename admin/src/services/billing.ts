import { api } from './api';
import type { BillingInvoice, BillingPlan, WorkspaceSettings } from '@/types';

export const billingService = {
  plan:      () => api.get<BillingPlan>('/settings/billing/plan'),
  invoices:  () => api.get<BillingInvoice[]>('/settings/billing/invoices'),
};

export const workspaceService = {
  get:    () => api.get<WorkspaceSettings>('/settings/workspace'),
  update: (data: Partial<WorkspaceSettings>) =>
    api.patch<WorkspaceSettings>('/settings/workspace', data),
};
