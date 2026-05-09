'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { ApiMessage, ApiSuperchatResponse } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

interface UseSuperchatResult {
  conversationId: string | null;
  messages: ApiMessage[];
  loading: boolean;
  send: (body: string) => Promise<void>;
}

/**
 * Convenience hook around the global Superchat room. Auto-joins on mount
 * (the GET endpoint also adds the user as participant if they aren't yet).
 */
export function useSuperchat(): UseSuperchatResult {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const idRef = useRef<string | null>(null);
  idRef.current = conversationId;

  // Initial load
  useEffect(() => {
    if (!user) {
      setMessages([]);
      setConversationId(null);
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
  }, [user]);

  // Join the room once we know the id
  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('chat:join', { conversationId });
    return () => {
      socket.emit('chat:leave', { conversationId });
    };
  }, [socket, conversationId]);

  // Listen for new messages
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

  return { conversationId, messages, loading, send };
}
