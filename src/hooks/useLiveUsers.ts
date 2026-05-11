'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiOnlineUser } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

const POLL_MS = 30_000; // refetch every 30s, plus on socket presence events

/**
 * Live list of online users. Initial fetch via REST (`/api/users/online`),
 * then refreshed every 30s and on `presence:online`/`presence:offline`
 * socket broadcasts.
 */
export function useLiveUsers(): { users: ApiOnlineUser[]; loading: boolean } {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [users, setUsers] = useState<ApiOnlineUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ users: ApiOnlineUser[] }>('/api/users/online');
      setUsers(res.users);
    } catch (err) {
      console.error('useLiveUsers fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch + polling fallback. Uses an abort flag for the
  // first fetch so a fast unmount / logout doesn't setState on a dead
  // instance. The interval-driven polls are guarded by `cancelled` too.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchOnce = () => {
      api
        .get<{ users: ApiOnlineUser[] }>('/api/users/online')
        .then((res) => {
          if (!cancelled) setUsers(res.users);
        })
        .catch((err) => {
          if (!cancelled) console.error('useLiveUsers fetch failed:', err);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    fetchOnce();
    const id = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  // Realtime presence — refetch on each event. The events themselves only
  // carry userId, so a refetch is the simplest way to also pick up
  // now-playing changes that come along.
  useEffect(() => {
    if (!socket) return;
    const reload = () => load();
    socket.on('presence:online', reload);
    socket.on('presence:offline', reload);
    return () => {
      socket.off('presence:online', reload);
      socket.off('presence:offline', reload);
    };
  }, [socket, load]);

  return { users, loading };
}
