'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type { ApiFeedPost } from '@/lib/api/types';

/**
 * Fetch admin-CMS published feed posts for the player's FeedPanel.
 *
 * Returns null while loading on first mount, then either the array
 * (possibly empty) or [] on failure. We intentionally don't throw
 * — the feed should keep rendering its mock content if the network
 * is sketchy, so a stale fallback beats an error state in the
 * resting view.
 */
export function useAdminFeedPosts(): {
  posts: ApiFeedPost[] | null;
  loading: boolean;
} {
  const [posts, setPosts] = useState<ApiFeedPost[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get<{ items: ApiFeedPost[] }>('/api/feed/posts?limit=20')
      .then((res) => {
        if (!cancelled) {
          setPosts(res.items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 means the user isn't logged in yet — keep posts as
        // null so the caller can render the mock feed cleanly.
        // Other errors: also fall back to empty so the resting UI
        // doesn't show a partial state.
        if (!(err instanceof ApiError) || err.status !== 401) {
          console.warn('admin feed fetch failed:', err);
        }
        setPosts([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { posts, loading };
}
