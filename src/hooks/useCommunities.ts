'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type { ApiCommunityCard } from '@/lib/api/types';

/**
 * List of communities with an optional search filter. Re-fetches
 * whenever `search` changes or `refresh()` is called by a caller
 * (after a join / create / leave so the membership flags + member
 * counts reflect the new state without a full reload).
 *
 * Disabled (`enabled: false`) means the hook stays inert — no
 * fetch fires, the result list stays empty. Used by the panel to
 * skip the network roundtrip while it's closed.
 */
export function useCommunities(args: {
  enabled: boolean;
  search?: string;
}) {
  const { enabled, search = '' } = args;
  const [items, setItems] = useState<ApiCommunityCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await api.get<{ items: ApiCommunityCard[] }>(
        `/api/communities${qs}`,
      );
      setItems(res.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setItems([]);
        setError(null);
      } else {
        console.error('useCommunities fetch failed:', err);
        setError(err instanceof Error ? err.message : 'fetch_failed');
      }
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return { items, loading, error, refresh };
}
