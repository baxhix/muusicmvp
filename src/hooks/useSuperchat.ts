'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiMessage, ApiSuperchatResponse } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

/**
 * Activity 'system message' injected into the chat feed when something
 * worth celebrating happens — currently fired by the listening:tick socket
 * handler when a user starts a new track in the room.
 */
export interface SuperchatActivity {
  kind: 'stream';
  /** Unique synthetic id used as React key + dedupe. */
  id: string;
  userId: string;
  userName: string | null;
  points: number;
  trackTitle: string;
  trackArtist: string;
  createdAt: string;
}

/**
 * Discriminated union of feed items rendered by the panel — either a real
 * chat message or a transient activity card.
 */
export type SuperchatFeedItem =
  | (ApiMessage & { _type: 'message' })
  | (SuperchatActivity & { _type: 'activity' });

interface UseSuperchatResult {
  conversationId: string | null;
  participantCount: number;
  feed: SuperchatFeedItem[];
  loading: boolean;
  send: (body: string) => Promise<void>;
}

/**
 * Hook around the global Superchat room. The GET endpoint also auto-joins
 * the caller as participant — to gate that behind an explicit "Entrar"
 * action, pass `enabled=false` until the user clicks the button.
 *
 * The returned `feed` is a merged, time-ordered list of real messages and
 * inline `chat:activity` events from the realtime layer. Activity items
 * are ephemeral — they only show during the session and don't persist.
 */
export function useSuperchat(enabled: boolean = true): UseSuperchatResult {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [activities, setActivities] = useState<SuperchatActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const idRef = useRef<string | null>(null);
  idRef.current = conversationId;

  // Initial load.
  useEffect(() => {
    if (!enabled || !user) {
      setMessages([]);
      setActivities([]);
      setConversationId(null);
      setParticipantCount(0);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<ApiSuperchatResponse>('/api/superchat')
      .then((res) => {
        if (cancelled) return;
        setConversationId(res.conversation.id);
        setMessages([...res.messages].reverse()); // newest-last for chat UIs
        setParticipantCount(res.participantCount);
      })
      .catch((err) => {
        console.error('superchat fetch failed:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, user]);

  // Join the conversation room once we know the id.
  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('chat:join', { conversationId });
    return () => {
      socket.emit('chat:leave', { conversationId });
    };
  }, [socket, conversationId]);

  // Subscribe to new chat messages.
  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg: ApiMessage) => {
      if (msg.conversationId !== idRef.current) return;
      setMessages((prev) => {
        const filtered = prev.filter(
          (m) => !m.id.startsWith('tmp-') || m.body !== msg.body,
        );
        if (filtered.some((m) => m.id === msg.id)) return filtered;
        return [...filtered, msg];
      });
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [socket]);

  // Subscribe to inline activity events.
  useEffect(() => {
    if (!socket) return;
    const onActivity = (raw: unknown) => {
      const payload = raw as Partial<SuperchatActivity> & {
        kind?: string;
        conversationId?: string;
      };
      if (payload?.kind !== 'stream') return;
      if (!payload.conversationId || payload.conversationId !== idRef.current) return;
      if (!payload.userId || !payload.trackTitle) return;

      const item: SuperchatActivity = {
        kind: 'stream',
        id: `act-${payload.userId}-${payload.createdAt ?? Date.now()}`,
        userId: payload.userId,
        userName: payload.userName ?? null,
        points: payload.points ?? 100,
        trackTitle: payload.trackTitle,
        trackArtist: payload.trackArtist ?? '',
        createdAt: payload.createdAt ?? new Date().toISOString(),
      };

      setActivities((prev) => {
        if (prev.some((a) => a.id === item.id)) return prev;
        // Keep only the most recent 50 to bound memory if the room is busy.
        return [...prev.slice(-49), item];
      });
    };
    socket.on('chat:activity', onActivity);
    return () => {
      socket.off('chat:activity', onActivity);
    };
  }, [socket]);

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text || !conversationId) return;

      const tempId = `tmp-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: tempId,
          conversationId,
          senderId: user?.id ?? '',
          body: text,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (!socket) {
        try {
          const res = await api.post<{ message: ApiMessage }>(
            `/api/conversations/${conversationId}/messages`,
            { body: text },
          );
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? res.message : m)),
          );
        } catch (err) {
          console.error('superchat send (REST) failed:', err);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }
        return;
      }

      socket.emit(
        'chat:send',
        { conversationId, body: text },
        (ack: { ok: boolean; error?: string } | undefined) => {
          if (!ack?.ok) {
            console.error('superchat send rejected:', ack?.error);
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          }
        },
      );
    },
    [conversationId, user, socket],
  );

  // Merge messages + activities by timestamp so the feed reads chronologically.
  const feed: SuperchatFeedItem[] = [
    ...messages.map((m): SuperchatFeedItem => ({ ...m, _type: 'message' })),
    ...activities.map((a): SuperchatFeedItem => ({ ...a, _type: 'activity' })),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return { conversationId, participantCount, feed, loading, send };
}
