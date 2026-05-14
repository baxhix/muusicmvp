'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { track } from '@/lib/analytics';
import type {
  ApiConversationSummary,
  ApiMessage,
  ApiMessageReaction,
} from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSocket } from './useSocket';

/** Count @[Name](uuid) tokens in a message body. Same regex shape
 *  the server uses to parse mentions — keeps the analytics
 *  mention_count consistent with what actually triggers
 *  comment_mention / chat_mention notifications. */
const MENTION_COUNT_RE = /@\[[^\]]+\]\([0-9a-f-]{36}\)/g;
function countMentions(body: string): number {
  return (body.match(MENTION_COUNT_RE) ?? []).length;
}

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
  /**
   * Toggle a reaction emoji on a message. Sends `chat:react` over the
   * socket and waits for the broadcast `chat:reaction` event to update
   * local state. Toggle semantics — calling with the same emoji twice
   * removes the user's reaction.
   */
  react: (messageId: string, emoji: string) => void;
  /** open or create a DM with another user */
  openDmWith: (otherUserId: string) => Promise<void>;
  /**
   * Create a new group conversation and open it. Calls
   * POST /api/conversations with the group payload; refreshes the
   * list and routes the user into the new conversation on success.
   */
  createGroup: (args: {
    name: string;
    memberIds: string[];
    imageUrl?: string | null;
  }) => Promise<void>;
  /** Force a refetch of the conversations list. Used by mutations
   *  done via REST (e.g. group image upload, add member) that don't
   *  go through the socket and therefore can't ride the existing
   *  chat:thread:update broadcast. */
  refreshConversations: () => Promise<void>;
  /**
   * Mark every message in this conversation as read for the current user.
   * Optimistically zeroes unreadCount locally and POSTs to the server.
   * Used by SuperchatPanel (which doesn't go through `open`) plus any
   * other surface that wants to reset the badge without rendering the
   * full LiveChatPanel.
   */
  markRead: (conversationId: string) => Promise<void>;
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
  // Mirror of `conversations` accessible from stale closures (the
  // socket `chat:send` ack runs outside the React render cycle).
  const conversationsRef = useRef<ApiConversationSummary[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
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
          // Optimistically zero this thread's unreadCount in the list while
          // the server-side mark-read POST is in flight.
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId ? { ...c, unreadCount: 0 } : c,
            ),
          );
        })
        .catch((err) => console.error('messages fetch failed:', err))
        .finally(() => setLoadingMessages(false));

      // Persist the read marker so it survives reloads / other devices.
      api
        .post(`/api/conversations/${conversationId}/read`)
        .catch((err) => console.error('mark read failed:', err));

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
            return;
          }
          // Resolve conversation type from the active conversation
          // in the local cache. The hook owns `conversations` (see
          // the list state above), so it's already in memory.
          const conv = conversationsRef.current.find((c) => c.id === activeId);
          const mentionCount = countMentions(text);
          track('chat_message_sent', {
            conversation_id: activeId,
            conversation_type: conv?.type ?? 'dm',
            body_length: text.length,
            mention_count: mentionCount,
          });
          if (mentionCount > 0) {
            track('chat_mention_used', {
              conversation_id: activeId,
              mention_count: mentionCount,
            });
          }
        },
      );
    },
    [activeId, socket, user],
  );

  // ── Toggle a reaction on a message via socket ────────────────────────
  const react = useCallback(
    (messageId: string, emoji: string) => {
      if (!socket) return;
      socket.emit(
        'chat:react',
        { messageId, emoji },
        (ack: { ok: boolean; error?: string } | undefined) => {
          if (!ack?.ok) {
            console.warn('chat:react rejected:', ack?.error);
            return;
          }
          // We don't yet know if the reaction was added or removed
          // (the server doesn't pipe action back through ack) — the
          // 'chat:reaction' broadcast we listen to elsewhere
          // resolves it, but for the analytics event we treat the
          // toggle as "added" optimistically. PostHog cohorts then
          // see one event per toggle.
          track('chat_message_reacted', {
            message_id: messageId,
            emoji,
            action: 'added',
          });
        },
      );
      // No optimistic local update — the server broadcasts the new
      // aggregated reactions to everyone in the conversation room
      // (including us) via `chat:reaction`, which then patches state.
    },
    [socket],
  );

  // ── Realtime: reactions update for the active thread ──────────────────
  useEffect(() => {
    if (!socket) return;
    const onReaction = (payload: {
      conversationId: string;
      messageId: string;
      reactions: ApiMessageReaction[];
    }) => {
      // Only update if the change is for the thread we're viewing.
      // Background reactions on other conversations don't affect the
      // message list rendered here.
      if (payload.conversationId !== activeIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === payload.messageId
            ? { ...m, reactions: payload.reactions }
            : m,
        ),
      );
    };
    socket.on('chat:reaction', onReaction);
    return () => {
      socket.off('chat:reaction', onReaction);
    };
  }, [socket]);

  // ── Realtime: incoming chat messages (active thread) ───────────────────
  useEffect(() => {
    if (!socket) return;
    const onMessage = (msg: ApiMessage) => {
      const isActive = msg.conversationId === activeIdRef.current;
      if (isActive) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.id.startsWith('tmp-') || m.body !== msg.body);
          if (filtered.some((m) => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
        // User is viewing this thread — keep the read marker fresh.
        api
          .post(`/api/conversations/${msg.conversationId}/read`)
          .catch((err) => console.error('mark read (active) failed:', err));
      }
      loadList();
    };
    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [socket, loadList]);

  // ── Realtime: per-user thread update poke (fires for ALL conversations
  // the user is in, even ones they haven't opened in this session) ────────
  useEffect(() => {
    if (!socket) return;
    const onThreadUpdate = () => loadList();
    socket.on('chat:thread:update', onThreadUpdate);
    return () => {
      socket.off('chat:thread:update', onThreadUpdate);
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

  // ── Create a new group + open it ─────────────────────────────────────
  const createGroup = useCallback(
    async (args: {
      name: string;
      memberIds: string[];
      imageUrl?: string | null;
    }) => {
      try {
        const res = await api.post<{ id: string; created: boolean }>(
          '/api/conversations',
          {
            type: 'group',
            name: args.name,
            memberIds: args.memberIds,
            imageUrl: args.imageUrl ?? null,
          },
        );
        await loadList();
        open(res.id);
      } catch (err) {
        console.error('createGroup failed:', err);
      }
    },
    [loadList, open],
  );

  const markRead = useCallback(async (conversationId: string) => {
    // No-op when nothing actually needs marking — both the local state
    // setter and the POST below are skipped if unreadCount is already 0.
    //
    // Why this matters: prev.map(...) ALWAYS returns a fresh array, even
    // when no element actually changed. React then re-renders the page,
    // and any caller that passes a fresh closure as `onMarkRead` ends up
    // recreating the callback on every render — which retriggers the
    // effect that called markRead in the first place. Infinite loop.
    let shouldFetch = false;
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conversationId);
      if (idx === -1) return prev;
      if (prev[idx].unreadCount === 0) return prev;
      shouldFetch = true;
      const next = [...prev];
      next[idx] = { ...next[idx], unreadCount: 0 };
      return next;
    });
    if (!shouldFetch) return;
    try {
      await api.post(`/api/conversations/${conversationId}/read`);
    } catch (err) {
      console.error('markRead failed:', err);
      // Rollback on failure — refetch the list to recover the true count.
      loadList();
    }
  }, [loadList]);

  return {
    conversations,
    loadingList,
    activeId,
    open,
    close,
    messages,
    loadingMessages,
    send,
    react,
    openDmWith,
    createGroup,
    refreshConversations: loadList,
    markRead,
  };
}
