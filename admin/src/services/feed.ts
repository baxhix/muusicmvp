import { api } from './api';
import type {
  FeedItem,
  FeedItemInput,
  FeedItemStatus,
  FeedItemType,
} from '@/types';

/**
 * Admin Feed CMS service. All paths live under /api/admin/feed/* so
 * the api.ts driver auto-routes them to the real muusic backend (the
 * mock driver in `services/api.ts` only catches legacy /posts and
 * /metrics paths — anything starting with /api/admin/ goes straight
 * through httpDriver). That means as long as APP_URL is set, this
 * service talks to a real DB.
 *
 * Image upload uses raw `fetch` because the shared `api` client
 * serializes JSON bodies — multipart needs a different content-type
 * handling. Still uses `credentials: 'include'` so the session
 * cookie flows.
 */

export interface FeedListParams {
  status?: FeedItemStatus | 'all';
  type?: FeedItemType | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FeedListResponse {
  items: FeedItem[];
  total: number;
}

function qs(params: FeedListParams): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.type) sp.set('type', params.type);
  if (params.search) sp.set('search', params.search);
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.offset) sp.set('offset', String(params.offset));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const feedService = {
  list: (params: FeedListParams = {}) =>
    api.get<FeedListResponse>(`/api/admin/feed${qs(params)}`),

  get: (id: string) => api.get<FeedItem>(`/api/admin/feed/${id}`),

  create: (input: FeedItemInput) =>
    api.post<FeedItem>('/api/admin/feed', input),

  update: (id: string, input: FeedItemInput) =>
    api.patch<FeedItem>(`/api/admin/feed/${id}`, input),

  remove: (id: string) =>
    api.delete<{ ok: true }>(`/api/admin/feed/${id}`),

  publishNow: (id: string) =>
    api.post<FeedItem>(`/api/admin/feed/${id}/publish`),

  setActive: (id: string, isActive: boolean) =>
    api.post<FeedItem>(`/api/admin/feed/${id}/active`, { isActive }),

  /**
   * Multipart image upload. Returns the public URL the admin form
   * appends to its `media` array. We bypass `api.ts` here because
   * its driver serializes bodies as JSON — multipart needs raw
   * fetch. Same credentials policy though, so the session cookie
   * still authenticates the upload.
   */
  uploadImage: async (file: File): Promise<{ url: string; filename: string }> => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${base}/api/admin/feed/upload`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    if (!res.ok) {
      // Surface the server error code so the caller can map it to a
      // human Toast (too_large / unsupported_type / etc.).
      let code = 'upload_failed';
      try {
        const body = await res.json();
        if (typeof body?.error === 'string') code = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(code);
    }
    return res.json();
  },

  /**
   * Sibling of `uploadImage` but for videos. Hits a separate route
   * (`/upload-video`) so the server can apply its own MIME and
   * size validation — videos cap at 100 MB and accept mp4/webm/mov/
   * ogv.
   */
  uploadVideo: async (file: File): Promise<{ url: string; filename: string }> => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${base}/api/admin/feed/upload-video`, {
      method: 'POST',
      body: form,
      credentials: 'include',
    });
    if (!res.ok) {
      let code = 'upload_failed';
      try {
        const body = await res.json();
        if (typeof body?.error === 'string') code = body.error;
      } catch {
        /* ignore */
      }
      throw new Error(code);
    }
    return res.json();
  },
};
