'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api/client';
import type { ApiRankingRow } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';

interface UseRankingResult {
  ranking: ApiRankingRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Global leaderboard data. Fetched on demand (when the modal opens) and
 * refreshable manually. Surfaces the underlying error code so the modal
 * can render a useful message ('migration_missing', 'network', etc.)
 * instead of an empty list.
 */
export function useRanking(enabled: boolean): UseRankingResult {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<ApiRankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ ranking: ApiRankingRow[] }>('/api/ranking');
      setRanking(res.ranking);
    } catch (err) {
      console.error('ranking fetch failed:', err);
      if (err instanceof ApiError) {
        const body = err.body as { error?: string } | null;
        setError(body?.error ?? `HTTP ${err.status}`);
      } else {
        setError('network_error');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Auto-fetch on enable transition. Aborted via `cancelled` flag so a
  // panel-close while the request is still in flight doesn't push stale
  // data onto a no-longer-rendered component.
  useEffect(() => {
    if (!enabled || !user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<{ ranking: ApiRankingRow[] }>('/api/ranking')
      .then((res) => {
        if (!cancelled) setRanking(res.ranking);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('ranking fetch failed:', err);
        if (err instanceof ApiError) {
          const body = err.body as { error?: string } | null;
          setError(body?.error ?? `HTTP ${err.status}`);
        } else {
          setError('network_error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, user]);

  // Refresh ao receber `app:points-awarded` enquanto o panel está
  // aberto — mantém o número do "me" no ranking sincronizado com
  // o que o ArtistBox mostra (useUserProfile faz o mesmo). Sem
  // isso, abrir o Superfãs, ganhar pontos com o painel aberto e
  // não ver o número subir era confuso.
  useEffect(() => {
    if (!enabled || !user) return;
    const handler = () => void refresh();
    window.addEventListener('app:points-awarded', handler);
    return () => window.removeEventListener('app:points-awarded', handler);
  }, [enabled, user, refresh]);

  return { ranking, loading, error, refresh };
}
