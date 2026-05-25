/**
 * Service de e-mails — espelho dos endpoints /api/admin/emails/*.
 * Todos os paths começam com /api/admin/ pra cair no httpDriver
 * automaticamente (ver pickDriver em ./api.ts).
 */

import { api } from './api';
import type { EmailDesign, BrandSettings } from './emailDesign';

export interface EmailTemplate {
  kind: string;
  label: string;
  description: string;
  variables: { name: string; description: string }[];
  defaultSubject: string;
  defaultHtml: string;
  defaultDesign: EmailDesign | null;
  isEdited: boolean;
  isActive: boolean;
  subject: string;
  html: string;
  design: EmailDesign | null;
  updatedAt: string | null;
}

export interface EmailLog {
  id: string;
  to: string;
  kind: string;
  subject: string;
  status: 'sent' | 'failed';
  errorMessage: string | null;
  campaignId: string | null;
  sentAt: string;
  durationMs: number | null;
}

export interface EmailMetrics {
  last30d: {
    total: number;
    sent: number;
    failed: number;
    failureRate: number;
    avgDurationMs: number | null;
  };
  byKindLast30d: Array<{ kind: string; total: number; sent: number; failed: number }>;
  daily: Array<{ day: string; sent: number; failed: number }>;
}

export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'canceled';
export type SegmentKind = 'all' | 'superfans' | 'inactive' | 'city' | 'custom_emails';

export interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  segment: SegmentKind;
  segmentParams: Record<string, unknown> | null;
  status: CampaignStatus;
  sentCount: number;
  failedCount: number;
  totalRecipients: number;
  scheduledAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface UpsertTemplateInput {
  kind: string;
  /** Nome amigável editável. Quando vazio/ausente, o server cai
   *  pro label do KNOWN_TEMPLATES (catálogo em código). */
  label?: string;
  subject: string;
  /** Quando `design` setado, o server REGENERA o html e ignora
   *  este campo. Mandar string vazia é OK no modo visual. */
  html: string;
  design?: EmailDesign | null;
  isActive: boolean;
  description?: string;
}

export interface CreateCampaignInput {
  name: string;
  subject: string;
  html: string;
  segment: SegmentKind;
  segmentParams?: {
    topPct?: number;
    days?: number;
    city?: string;
    emails?: string[];
  };
  scheduledAt?: string;
  preview?: boolean;
}

export const emailsService = {
  templates: {
    list: () =>
      api.get<{ items: EmailTemplate[] }>('/api/admin/emails/templates'),
    upsert: (input: UpsertTemplateInput) =>
      api.post<{ ok: boolean; template: EmailTemplate }>(
        '/api/admin/emails/templates',
        input,
      ),
    test: (input: { kind: string; subject: string; html: string }) =>
      api.post<{ ok: boolean; sentTo: string }>(
        '/api/admin/emails/templates/test',
        input,
      ),
    /** Remove um template editado do DB. Templates conhecidos voltam
     *  a usar o fallback hardcoded; customizados somem da lista. */
    remove: (kind: string) =>
      api.delete<{ ok: boolean; deleted: boolean }>(
        `/api/admin/emails/templates/${kind}`,
      ),
  },

  logs: {
    list: (params: {
      limit?: number;
      offset?: number;
      kind?: string;
      status?: 'sent' | 'failed';
      toContains?: string;
      sinceDays?: number;
    }) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      }
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return api.get<{ items: EmailLog[] }>(`/api/admin/emails/logs${suffix}`);
    },
  },

  metrics: {
    get: (days = 30) =>
      api.get<EmailMetrics>(`/api/admin/emails/metrics?days=${days}`),
  },

  /** Brand settings — config global aplicada a TODOS os emails:
   *  logo no header + footer institucional (links + redes sociais).
   *  Singleton: 1 row no DB. */
  brand: {
    get: () => api.get<{ settings: BrandSettings }>('/api/admin/emails/brand'),
    upsert: (settings: BrandSettings) =>
      api.post<{ ok: boolean; settings: BrandSettings }>(
        '/api/admin/emails/brand',
        settings,
      ),
  },

  campaigns: {
    list: () =>
      api.get<{ items: EmailCampaign[] }>('/api/admin/emails/campaigns'),
    create: (input: CreateCampaignInput) =>
      api.post<{ ok: boolean; campaign: EmailCampaign } | { count: number }>(
        '/api/admin/emails/campaigns',
        input,
      ),
    send: (id: string) =>
      api.post<{ ok: boolean; status: string; id: string }>(
        `/api/admin/emails/campaigns/${id}/send`,
      ),
  },
};
