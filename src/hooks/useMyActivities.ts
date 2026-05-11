'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiActivityItem } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

interface UseMyActivitiesResult {
  items: ApiActivityItem[];
  totalPoints: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Current user's activity ledger (Minha Atividade). Auto-refreshes on
 * `notify:new` socket events so streams/likes/chats logged in the
 * background show up without F5.
 */
export function useMyActivities(): UseMyActivitiesResult {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [items, setItems] = useState<ApiActivityItem[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{
        items: ApiActivityItem[];
        hasMore: boolean;
        totalPoints: number;
      }>('/api/me/activities');
      setItems(res.items);
      setTotalPoints(res.totalPoints);
    } catch (err) {
      console.error('activities fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch — same aborted-flag pattern as useListeningHistory so
  // unmount during the in-flight request doesn't setState on dead state.
  useEffect(() => {
    if (!user) {
      setItems([]);
      setTotalPoints(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<{ items: ApiActivityItem[]; hasMore: boolean; totalPoints: number }>(
        '/api/me/activities',
      )
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotalPoints(res.totalPoints);
      })
      .catch((err) => {
        if (!cancelled) console.error('activities fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Stream activities fire alongside same_track notify:new events, and
  // chat_started fires the chat:thread:update poke. Both signal it's
  // worth refetching.
  useEffect(() => {
    if (!socket) return;
    const onPoke = () => refresh();
    socket.on('notify:new', onPoke);
    socket.on('chat:thread:update', onPoke);
    return () => {
      socket.off('notify:new', onPoke);
      socket.off('chat:thread:update', onPoke);
    };
  }, [socket, refresh]);

  return { items, totalPoints, loading, refresh };
}
