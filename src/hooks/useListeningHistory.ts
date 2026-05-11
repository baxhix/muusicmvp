'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiHistoryItem } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

interface UseListeningHistoryResult {
  items: ApiHistoryItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  toggleLike: (trackId: string) => Promise<void>;
}

/**
 * Fetches the current user's listening history (deduped by track,
 * most-recent-first) and lets the UI toggle likes with optimistic updates.
 *
 * Auto-refreshes when the realtime `notify:new` event fires — that's emitted
 * on any listening tick where the track changes, so the history list stays
 * fresh while the user is still in the app.
 */
export function useListeningHistory(): UseListeningHistoryResult {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [items, setItems] = useState<ApiHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ items: ApiHistoryItem[]; hasMore: boolean }>(
        '/api/me/history',
      );
      setItems(res.items);
    } catch (err) {
      console.error('history fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch — uses an aborted-flag pattern so unmounting / logout
  // during the in-flight request doesn't fire setState on a dead instance.
  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<{ items: ApiHistoryItem[]; hasMore: boolean }>('/api/me/history')
      .then((res) => {
        if (!cancelled) setItems(res.items);
      })
      .catch((err) => {
        if (!cancelled) console.error('history fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Pick up new entries as the user listens. Two pokes:
  //   - `me:activity:new` fires to the LISTENING user's own room when
  //     they change tracks — this is the one that keeps Histórico live
  //     while the panel stays open.
  //   - `notify:new` is for receiving same-track notifications about
  //     other users; we re-fetch on it too because that's a moment
  //     the user might want to glance at their list anyway.
  useEffect(() => {
    if (!socket) return;
    const onPoke = () => refresh();
    socket.on('me:activity:new', onPoke);
    socket.on('notify:new', onPoke);
    return () => {
      socket.off('me:activity:new', onPoke);
      socket.off('notify:new', onPoke);
    };
  }, [socket, refresh]);

  const toggleLike = useCallback(async (trackId: string) => {
    const prev = items;
    const target = prev.find((i) => i.trackId === trackId);
    if (!target) return;

    // Optimistic flip
    setItems((cur) =>
      cur.map((i) => (i.trackId === trackId ? { ...i, liked: !i.liked } : i)),
    );

    try {
      if (target.liked) {
        await api.delete(`/api/me/tracks/${trackId}/like`);
      } else {
        await api.post(`/api/me/tracks/${trackId}/like`);
      }
    } catch (err) {
      console.error('toggleLike failed:', err);
      // Rollback
      setItems(prev);
    }
  }, [items]);

  return { items, loading, refresh, toggleLike };
}
