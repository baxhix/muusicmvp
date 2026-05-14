import { api } from './api';
import type { SiteTag, SiteTagKind } from '@/types';

/**
 * Site tracking-tag service. Like the feed service, every path
 * lives under /api/admin/* so the api.ts driver auto-routes it
 * to the real muusic backend.
 *
 * `save` is an upsert: empty value → tag effectively disabled
 * even if `enabled=true` (server clamps that combination), so
 * "clear this pixel" is just `save({ kind, value: '', enabled: false })`.
 */
export const siteTagsService = {
  list: () =>
    api.get<{ items: SiteTag[] }>('/api/admin/site-tags'),

  save: (kind: SiteTagKind, value: string, enabled: boolean) =>
    api.patch<{ ok: true }>(`/api/admin/site-tags/${kind}`, { value, enabled }),
};
