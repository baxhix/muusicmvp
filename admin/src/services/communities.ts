import { api } from './api';
import type {
  AdminCommunity,
  AdminCommunityMember,
  AdminCommunityTopic,
  AdminCommunityTopicComment,
} from '@/types';

/**
 * Communities admin service. All paths are under /api/admin/* so
 * the api.ts driver auto-routes them to the real muusic backend
 * (httpDriver). No mock fallback — the admin Communities surface
 * always talks to the live DB. If APP_URL isn't set, calls fail
 * with the standard "[api] … → 401" and the UI shows the empty
 * state instead of fake data (cleaner for QA than mock drift).
 */

export interface CommunityListParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CommunityListResponse {
  items: AdminCommunity[];
  total: number;
}

export interface CommunityDetailResponse {
  community: AdminCommunity;
}

export interface MemberListParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MemberListResponse {
  items: AdminCommunityMember[];
  total: number;
}

export interface TopicListParams {
  search?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface TopicListResponse {
  items: AdminCommunityTopic[];
  total: number;
}

export interface CommentListParams {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface CommentListResponse {
  items: AdminCommunityTopicComment[];
  total: number;
}

export interface CommunityPatchInput {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  creatorId?: string;
}

export interface TopicPatchInput {
  title?: string;
  body?: string | null;
  /** null = restore, true = soft-delete. */
  deletedAt?: null | true;
}

function qs(params: object): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const communitiesService = {
  list: (params: CommunityListParams = {}) =>
    api.get<CommunityListResponse>(`/api/admin/communities${qs(params)}`),

  get: (slug: string) =>
    api.get<CommunityDetailResponse>(`/api/admin/communities/${slug}`),

  update: (slug: string, input: CommunityPatchInput) =>
    api.patch<CommunityDetailResponse>(
      `/api/admin/communities/${slug}`,
      input,
    ),

  remove: (slug: string) =>
    api.delete<{ ok: true }>(`/api/admin/communities/${slug}`),

  /* ── Members ── */
  listMembers: (slug: string, params: MemberListParams = {}) =>
    api.get<MemberListResponse>(
      `/api/admin/communities/${slug}/members${qs(params)}`,
    ),

  removeMember: (slug: string, userId: string) =>
    api.delete<{ removed: boolean }>(
      `/api/admin/communities/${slug}/members/${userId}`,
    ),

  /* ── Topics ── */
  listTopics: (slug: string, params: TopicListParams = {}) =>
    api.get<TopicListResponse>(
      `/api/admin/communities/${slug}/topics${qs(params)}`,
    ),

  getTopic: (slug: string, topicId: string) =>
    api.get<{ topic: AdminCommunityTopic }>(
      `/api/admin/communities/${slug}/topics/${topicId}`,
    ),

  patchTopic: (slug: string, topicId: string, input: TopicPatchInput) =>
    api.patch<{ topic: AdminCommunityTopic }>(
      `/api/admin/communities/${slug}/topics/${topicId}`,
      input,
    ),

  /** Hard delete by default. Pass `hard: false` to soft-delete instead. */
  removeTopic: (slug: string, topicId: string, opts: { hard?: boolean } = {}) =>
    api.delete<{ ok: true }>(
      `/api/admin/communities/${slug}/topics/${topicId}${
        opts.hard === false ? '?hard=false' : ''
      }`,
    ),

  /* ── Comments ── */
  listComments: (
    slug: string,
    topicId: string,
    params: CommentListParams = {},
  ) =>
    api.get<CommentListResponse>(
      `/api/admin/communities/${slug}/topics/${topicId}/comments${qs(params)}`,
    ),

  /** Toggle soft-delete on a comment (`deletedAt: null` to restore). */
  patchComment: (
    slug: string,
    topicId: string,
    commentId: string,
    deletedAt: null | true,
  ) =>
    api.patch<{ ok: true }>(
      `/api/admin/communities/${slug}/topics/${topicId}/comments/${commentId}`,
      { deletedAt },
    ),

  removeComment: (
    slug: string,
    topicId: string,
    commentId: string,
    opts: { hard?: boolean } = {},
  ) =>
    api.delete<{ ok: true }>(
      `/api/admin/communities/${slug}/topics/${topicId}/comments/${commentId}${
        opts.hard === false ? '?hard=false' : ''
      }`,
    ),
};
