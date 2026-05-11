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

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    refresh();
  }, [user, refresh]);

  // Pick up new entries as the user listens — same_track notifications fire
  // on each track change, which is also when listening_history gets a new row.
  useEffect(() => {
    if (!socket) return;
    const onPoke = () => refresh();
    socket.on('notify:new', onPoke);
    return () => {
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
