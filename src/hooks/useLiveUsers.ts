'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiOnlineUser } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

const POLL_MS = 30_000; // refetch every 30s, plus on socket presence events

/** Response shape from /api/users/online. */
interface OnlineUsersResponse {
  users: ApiOnlineUser[];
  totalRegistered: number;
}

/**
 * Live list of online users + total registered head-count. Initial
 * fetch via REST (`/api/users/online`), then refreshed every 30s and
 * on `presence:batch` socket broadcasts (server coalesces presence
 * transitions into per-250ms batched payloads to avoid storms).
 *
 * `totalRegistered` powers the ambient "fan presence" dots scattered
 * on the map — independent from `users.length` which only counts
 * users currently online.
 */
export function useLiveUsers(): {
  users: ApiOnlineUser[];
  totalRegistered: number;
  loading: boolean;
} {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [users, setUsers] = useState<ApiOnlineUser[]>([]);
  const [totalRegistered, setTotalRegistered] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<OnlineUsersResponse>('/api/users/online');
      setUsers(res.users);
      setTotalRegistered(res.totalRegistered ?? 0);
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
        .get<OnlineUsersResponse>('/api/users/online')
        .then((res) => {
          if (cancelled) return;
          setUsers(res.users);
          setTotalRegistered(res.totalRegistered ?? 0);
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

  // Realtime presence — refetch on each batched event. The server
  // coalesces individual presence:online/offline transitions into
  // one `presence:batch` per 250ms window so a 1k-user reconnect
  // storm doesn't fan out to a 1M socket-write thunder. Refetch is
  // still the simplest way to also pick up now-playing changes
  // that come along; the batch is just the trigger.
  useEffect(() => {
    if (!socket) return;
    const reload = () => load();
    socket.on('presence:batch', reload);
    return () => {
      socket.off('presence:batch', reload);
    };
  }, [socket, load]);

  return { users, totalRegistered, loading };
}
