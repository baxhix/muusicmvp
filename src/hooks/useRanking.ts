'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiRankingRow } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';

interface UseRankingResult {
  ranking: ApiRankingRow[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Global leaderboard data. Fetched on demand (when the modal opens) and
 * refreshable manually.
 */
export function useRanking(enabled: boolean): UseRankingResult {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<ApiRankingRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await api.get<{ ranking: ApiRankingRow[] }>('/api/ranking');
      setRanking(res.ranking);
    } catch (err) {
      console.error('ranking fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  return { ranking, loading, refresh };
}
