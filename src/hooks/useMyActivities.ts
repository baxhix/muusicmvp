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

  // Three pokes converge here so the activity ledger stays live:
  //   - `me:activity:new` — fires to the user's own room on their own
  //     listening track-change (this is the one that was missing before
  //     and kept the panel stale during solo listening).
  //   - `notify:new` — fires when another user starts the same track;
  //     a same-track row also lands in the user's history-relevant
  //     timeline, so re-fetch is appropriate.
  //   - `chat:thread:update` — fires for any conversation update.
  //     chat_started is the only activity-kind under chat, so this
  //     keeps the points total in sync after a fresh DM.
  useEffect(() => {
    if (!socket) return;
    const onPoke = () => refresh();
    socket.on('me:activity:new', onPoke);
    socket.on('notify:new', onPoke);
    socket.on('chat:thread:update', onPoke);
    return () => {
      socket.off('me:activity:new', onPoke);
      socket.off('notify:new', onPoke);
      socket.off('chat:thread:update', onPoke);
    };
  }, [socket, refresh]);

  return { items, totalPoints, loading, refresh };
}
