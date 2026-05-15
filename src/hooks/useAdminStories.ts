'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type { ApiFeedPost } from '@/lib/api/types';

/**
 * Fetch admin-CMS published STORIES for the public Stories rail.
 *
 * Mirrors `useAdminFeedPosts` but hits the same endpoint with a
 * `type=story` filter so the response excludes the regular feed
 * posts. The public listing already filters out expired stories
 * server-side (`expires_at IS NULL OR expires_at > now()`), so we
 * just render whatever comes back.
 *
 * Soft-fails (network/401) by returning [] — the rail still shows
 * the mock content for unauthenticated visitors.
 */
export function useAdminStories(): {
  stories: ApiFeedPost[];
  loading: boolean;
} {
  const [stories, setStories] = useState<ApiFeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ items: ApiFeedPost[] }>('/api/feed/posts?type=story&limit=20')
      .then((res) => {
        if (cancelled) return;
        // Drop entries that have no media — those are admin
        // mistakes that shouldn't sneak through, but render
        // defensively.
        setStories(res.items.filter((p) => p.media && p.media.length > 0));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!(err instanceof ApiError) || err.status !== 401) {
          console.warn('admin stories fetch failed:', err);
        }
        setStories([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { stories, loading };
}
