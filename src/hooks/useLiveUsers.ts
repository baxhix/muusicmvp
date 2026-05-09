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

  // Initial fetch + polling fallback (covers cases where the socket is down
  // or behind a flaky proxy).
  useEffect(() => {
    if (!user) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [user, load]);

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
