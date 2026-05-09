'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type {
  ApiConversationSummary,
  ApiMessage,
} from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

interface UseChatLiveResult {
  conversations: ApiConversationSummary[];
  loadingList: boolean;
  /** id of the conversation currently open in the chat panel */
  activeId: string | null;
  open: (conversationId: string) => void;
  close: () => void;
  /** messages of the active conversation, oldest → newest */
  messages: ApiMessage[];
  loadingMessages: boolean;
  send: (body: string) => Promise<void>;
  /** open or create a DM with another user */
  openDmWith: (otherUserId: string) => Promise<void>;
}

/**
 * Top-level chat state. List of conversations + currently-open thread,
 * realtime message delivery via Socket.IO.
 *
 * Parent components (page.tsx) own the active id only via this hook —
 * ChatStack reads `conversations`, ChatPanel reads `messages` + `send`.
 */
export function useChatLive(): UseChatLiveResult {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [conversations, setConversations] = useState<ApiConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ── Initial conversation list ──────────────────────────────────────────
  const loadList = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ conversations: ApiConversationSummary[] }>(
        '/api/conversations',
      );
      setConversations(res.conversations);
    } catch (err) {
      console.error('chat list fetch failed:', err);
    } finally {
      setLoadingList(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoadingList(false);
      return;
    }
    loadList();
  }, [user, loadList]);

  // ── Open a conversation: load history + join the socket room ───────────
  const open = useCallback(
    (conversationId: string) => {
      setActiveId(conversationId);
      setMessages([]);
      setLoadingMessages(true);

      api
        .get<{ messages: ApiMessage[]; hasMore: boolean }>(
          `/api/conversations/${conversationId}/messages`,
        )
        .then((res) => {
          // API returns newest-first; flip to oldest-first for display.
          setMessages([...res.messages].reverse());
        })
        .catch((err) => console.error('messages fetch failed:', err))
        .finally(() => setLoadingMessages(false));

      socket?.emit('chat:join', { conversationId });
    },
    [socket],
  );

  const close = useCallback(() => {
    if (activeId && socket) socket.emit('chat:leave', { conversationId: activeId });
    setActiveId(null);
    setMessages([]);
  }, [activeId, socket]);

  // ── Send a message via socket (server persists + broadcasts) ───────────
  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text || !activeId) return;

      // Optimistic — also gets replaced when the broadcast arrives.
      const tempId = `tmp-${Date.now()}`;
      const optimistic: ApiMessage = {
        id: tempId,
        conversationId: activeId,
        senderId: user?.id ?? '',
        body: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      if (!socket) {
        // Fallback: REST POST
        try {
          const res = await api.post<{ message: ApiMessage }>(
            `/api/conversations/${activeId}/messages`,
            { body: text },
          );
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? res.message : m)),
          );
        } catch (err) {
          console.error('send (REST) failed:', err);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }
        return;
      }

      socket.emit(
        'chat:send',
        { conversationId: activeId, body: text },
        (ack: { ok: boolean; messageId?: string; error?: string } | undefined) => {
          if (!ack?.ok) {
            console.error('chat:send rejected:', ack?.error);
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
          }
        },
      );
    },
    [activeId, socket, user],
  );

  // ── Realtime: incoming chat messages ───────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg: ApiMessage) => {
      // Append if it's for the active conversation; replace optimistic.
      if (msg.conversationId === activeIdRef.current) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.id.startsWith('tmp-') || m.body !== msg.body);
          if (filtered.some((m) => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
      }
      // Always nudge the conversation list (move-to-top + lastMessage update).
      loadList();
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [socket, loadList]);

  // ── Open or create a DM with someone (e.g. clicking a user on the map) ─
  const openDmWith = useCallback(
    async (otherUserId: string) => {
      try {
        const res = await api.post<{ id: string; created: boolean }>(
          '/api/conversations',
          { otherUserId },
        );
        if (res.created) await loadList();
        open(res.id);
      } catch (err) {
        console.error('openDmWith failed:', err);
      }
    },
    [loadList, open],
  );

  return {
    conversations,
    loadingList,
    activeId,
    open,
    close,
    messages,
    loadingMessages,
    send,
    openDmWith,
  };
}
