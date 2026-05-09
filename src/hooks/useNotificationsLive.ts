'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiNotification } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

interface UseNotificationsLiveResult {
  notifications: ApiNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Maintains the user's notification list. Initial fetch via REST,
 * realtime appended via socket events:
 *   - `notify:new` — fired by the server when a same_track notification
 *     is created (the row is already in DB; the event is just a poke
 *     to re-fetch and animate UI).
 */
export function useNotificationsLive(): UseNotificationsLiveResult {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ notifications: ApiNotification[] }>(
        '/api/notifications',
      );
      setNotifications(res.notifications);
    } catch (err) {
      console.error('notifications fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    load();
  }, [user, load]);

  useEffect(() => {
    if (!socket) return;
    const onNew = () => load();
    socket.on('notify:new', onNew);
    return () => {
      socket.off('notify:new', onNew);
    };
  }, [socket, load]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch (err) {
      console.error('markRead failed:', err);
      // Roll back optimistic update on failure.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: null } : n)),
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.readAt);
    await Promise.all(unread.map((n) => markRead(n.id)));
  }, [notifications, markRead]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return { notifications, unreadCount, loading, markRead, markAllRead };
}
