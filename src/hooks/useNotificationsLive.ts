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

  // Initial fetch with abort-flag pattern.
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<{ notifications: ApiNotification[] }>('/api/notifications')
      .then((res) => {
        if (!cancelled) setNotifications(res.notifications);
      })
      .catch((err) => {
        if (!cancelled) console.error('notifications fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return;
    // The realtime layer pokes the client with a small payload
    // including the notification `kind` so we can react beyond
    // just refetching the list. Today the one kind that gets a
    // viewport-level visual is `'waved'` — fire the global
    // `app:hearts-cascade` event so the HeartsCascade overlay
    // celebrates the RECEIVER (per product feedback "Estou com
    // dois usuários online e as notificações de coração só
    // aparecem para o usuário que fez, o que recebeu não
    // chegou"). Other kinds (same_track, message, mention, etc.)
    // continue with just the refetch.
    //
    // The payload also carries the sender's id + display name so
    // the `WaveReceiveOverlay` mounted at the layout level can
    // render a "[sender] enviou corações para você" message with
    // a clickable link to /app/u/<sourceUserId>. Per product
    // feedback "a tela do usuário que receber, além dos corações
    // caindo, deverá ficar com uma camada preta com transparência
    // leve e a mensagem centralizada".
    const onNew = (payload?: {
      kind?: string;
      sourceUserId?: string;
      sourceName?: string;
      sourceAvatarUrl?: string;
    }) => {
      load();
      if (payload?.kind === 'waved' && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('app:hearts-cascade', {
            detail: {
              sourceUserId: payload.sourceUserId ?? null,
              sourceName: payload.sourceName ?? null,
              sourceAvatarUrl: payload.sourceAvatarUrl ?? null,
            },
          }),
        );
      }
    };
    socket.on('notify:new', onNew);
    return () => {
      socket.off('notify:new', onNew);
    };
  }, [socket, load]);

  const markRead = useCallback(async (id: string) => {
    // No-op when already read — preserves array identity so React doesn't
    // re-render unnecessarily (and avoids potential closure-in-dep loops
    // in consumer effects).
    let shouldPost = false;
    setNotifications((prev) => {
      const idx = prev.findIndex((n) => n.id === id);
      if (idx === -1) return prev;
      if (prev[idx].readAt) return prev;
      shouldPost = true;
      const next = [...prev];
      next[idx] = { ...next[idx], readAt: new Date().toISOString() };
      return next;
    });
    if (!shouldPost) return;
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
