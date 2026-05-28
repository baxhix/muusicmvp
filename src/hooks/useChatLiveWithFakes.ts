'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApiConversationSummary,
  ApiMessage,
  ApiMessageAttachment,
  ApiMessageReaction,
} from '@/lib/api/types';
import {
  FAKE_ANA_CONVERSATION_ID,
  FAKE_ANA_USER_ID,
  FAKE_CENTRAL_CONVERSATION_ID,
  FAKE_CENTRAL_USER_ID,
  FAKE_CENTRAL_AVATAR_URL,
  buildAnaConversation,
  buildCentralConversation,
  buildInitialAnaMessages,
  buildInitialCentralMessages,
  pickRandomAnaMessage,
  pickRandomAnaReply,
  pickRandomCentralMessage,
} from '@/lib/fakeAna';
import { useAuth } from '@/lib/auth/AuthContext';
import { useChatLive } from './useChatLive';

/** Cadence at which Ana auto-posts a new "I'm online" message. */
const ANA_AUTO_INTERVAL_MS = 2 * 60 * 1000;

/** Delay after a fan replies before Ana sends a canned thank-you. */
const ANA_REPLY_DELAY_MS = 2_500;

/** Central account auto-cadence — slightly slower than Ana's (the
 *  "official news" feel) so the two streams don't fire in lockstep. */
const CENTRAL_AUTO_INTERVAL_MS = 2.5 * 60 * 1000;

/**
 * Wraps `useChatLive` and merges a hardcoded "Ana Castela" DM into
 * the conversation list. The fake conversation is fully client-side:
 *
 *   - It shows up at the TOP of the list (newest first by lastMessage)
 *   - Opening it loads a local message buffer instead of hitting the API
 *   - Sending a message appends locally (no socket round-trip) and
 *     triggers a canned Ana reply on a short delay
 *   - A background timer appends a random Ana message every 2 minutes
 *
 * Components downstream don't need to know any of this — the hook
 * exposes the same interface as `useChatLive`.
 */
export function useChatLiveWithFakes() {
  const { user } = useAuth();
  const base = useChatLive();

  // Fake conversation state — owned entirely by this wrapper. Same
  // shape for both Ana and Central so the auto-post + send overrides
  // can share helpers.
  const [anaMessages, setAnaMessages] = useState<ApiMessage[]>(() =>
    buildInitialAnaMessages(),
  );
  const [centralMessages, setCentralMessages] = useState<ApiMessage[]>(() =>
    buildInitialCentralMessages(),
  );
  // `activeOverride` flips on when the fan opens a fake thread. While
  // it's set, the wrapper short-circuits open/close/send/messages.
  // Holds the conversation id (Ana's or Central's) so callers know
  // which fake is open.
  const [activeOverride, setActiveOverride] = useState<string | null>(null);
  // Unread badge tracking for the fake conversations. Reset to 0 the
  // moment the fan opens the thread; goes up when a new auto-message
  // lands while they're NOT actively viewing it.
  const [anaUnread, setAnaUnread] = useState(0);
  const [centralUnread, setCentralUnread] = useState(0);

  // Refs of "is THIS fake the active thread?" so the auto-post
  // intervals can avoid bumping unread when the user is already
  // watching messages stream in.
  const isAnaActiveRef = useRef(false);
  isAnaActiveRef.current = activeOverride === FAKE_ANA_CONVERSATION_ID;
  const isCentralActiveRef = useRef(false);
  isCentralActiveRef.current = activeOverride === FAKE_CENTRAL_CONVERSATION_ID;

  // ── Auto-post Ana messages on a 2-minute cadence ────────────────
  useEffect(() => {
    if (!user) return; // No interval when logged out — nothing to talk to.
    const id = setInterval(() => {
      const text = pickRandomAnaMessage();
      const now = new Date().toISOString();
      const newMsg: ApiMessage = {
        id: `fake-ana-auto-${Date.now()}`,
        conversationId: FAKE_ANA_CONVERSATION_ID,
        senderId: FAKE_ANA_USER_ID,
        body: text,
        createdAt: now,
        senderName: 'Ana Castela',
        senderAvatarUrl: '/ana-castela.png',
      };
      setAnaMessages((prev) => [...prev, newMsg]);
      // Only bump the unread badge when the fan isn't actively
      // viewing Ana's thread.
      if (!isAnaActiveRef.current) {
        setAnaUnread((u) => u + 1);
      }
    }, ANA_AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user]);

  // ── Auto-post Central messages (~2.5 min cadence) ───────────────
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      const text = pickRandomCentralMessage();
      const now = new Date().toISOString();
      const newMsg: ApiMessage = {
        id: `fake-central-auto-${Date.now()}`,
        conversationId: FAKE_CENTRAL_CONVERSATION_ID,
        senderId: FAKE_CENTRAL_USER_ID,
        body: text,
        createdAt: now,
        senderName: 'Central Ana Castela',
        senderAvatarUrl: FAKE_CENTRAL_AVATAR_URL,
      };
      setCentralMessages((prev) => [...prev, newMsg]);
      if (!isCentralActiveRef.current) {
        setCentralUnread((u) => u + 1);
      }
    }, CENTRAL_AUTO_INTERVAL_MS);
    return () => clearInterval(id);
  }, [user]);

  // ── Merged conversation list ────────────────────────────────────
  const anaConv = useMemo<ApiConversationSummary>(
    () =>
      buildAnaConversation({
        lastMessage: anaMessages[anaMessages.length - 1] ?? null,
        unreadCount: anaUnread,
      }),
    [anaMessages, anaUnread],
  );
  const centralConv = useMemo<ApiConversationSummary>(
    () =>
      buildCentralConversation({
        lastMessage: centralMessages[centralMessages.length - 1] ?? null,
        unreadCount: centralUnread,
      }),
    [centralMessages, centralUnread],
  );

  const conversations = useMemo<ApiConversationSummary[]>(() => {
    // Pin Ana first, then Central, then real conversations. Both
    // verified accounts get hero slots at the top of the dock.
    return [anaConv, centralConv, ...base.conversations];
  }, [anaConv, centralConv, base.conversations]);

  // Convenience predicate — used in several callbacks below.
  const isFakeId = (id: string) =>
    id === FAKE_ANA_CONVERSATION_ID || id === FAKE_CENTRAL_CONVERSATION_ID;

  // ── Override open/close/send for fake threads ───────────────────
  const open = useCallback(
    (conversationId: string) => {
      if (isFakeId(conversationId)) {
        // Close any real conversation, mark the fake as active,
        // and zero out the right unread counter.
        if (base.activeId) base.close();
        setActiveOverride(conversationId);
        if (conversationId === FAKE_ANA_CONVERSATION_ID) setAnaUnread(0);
        else setCentralUnread(0);
      } else {
        if (activeOverride) setActiveOverride(null);
        base.open(conversationId);
      }
    },
    [base, activeOverride],
  );

  const close = useCallback(() => {
    if (activeOverride) {
      setActiveOverride(null);
    } else {
      base.close();
    }
  }, [base, activeOverride]);

  const send = useCallback(
    async (
      body: string,
      attachments?: ApiMessageAttachment[] | null,
    ) => {
      const text = body.trim();
      const hasAttachments = !!attachments && attachments.length > 0;
      /* Espelha o LiveChatPanel: aceita envio só de imagem (body
       * vazio + attachments). Sem essa flexibilização, o composer
       * mandava attachments mas o wrapper retornava silenciosamente
       * aqui e nem o base.send chegava a ser chamado. */
      if (!text && !hasAttachments) return;

      if (activeOverride === FAKE_ANA_CONVERSATION_ID) {
        // Ana branch — fan message appended locally + canned reply.
        // Fake convs herdam attachments só pra echo local, sem
        // round-trip: a imagem fica visível no fluxo mas o "envio"
        // é puramente client-side.
        const fanMsg: ApiMessage = {
          id: `fake-ana-fan-${Date.now()}`,
          conversationId: FAKE_ANA_CONVERSATION_ID,
          senderId: user?.id ?? '',
          body: text,
          createdAt: new Date().toISOString(),
          attachments: hasAttachments ? attachments! : undefined,
        };
        setAnaMessages((prev) => [...prev, fanMsg]);
        setTimeout(() => {
          const reply: ApiMessage = {
            id: `fake-ana-reply-${Date.now()}`,
            conversationId: FAKE_ANA_CONVERSATION_ID,
            senderId: FAKE_ANA_USER_ID,
            body: pickRandomAnaReply(),
            createdAt: new Date().toISOString(),
            senderName: 'Ana Castela',
            senderAvatarUrl: '/ana-castela.png',
          };
          setAnaMessages((prev) => [...prev, reply]);
        }, ANA_REPLY_DELAY_MS);
        return;
      }

      if (activeOverride === FAKE_CENTRAL_CONVERSATION_ID) {
        // Central branch — fan message appended locally + a generic
        // auto-ack from the news desk. Tone is informative.
        const fanMsg: ApiMessage = {
          id: `fake-central-fan-${Date.now()}`,
          conversationId: FAKE_CENTRAL_CONVERSATION_ID,
          senderId: user?.id ?? '',
          body: text,
          createdAt: new Date().toISOString(),
          attachments: hasAttachments ? attachments! : undefined,
        };
        setCentralMessages((prev) => [...prev, fanMsg]);
        setTimeout(() => {
          const reply: ApiMessage = {
            id: `fake-central-reply-${Date.now()}`,
            conversationId: FAKE_CENTRAL_CONVERSATION_ID,
            senderId: FAKE_CENTRAL_USER_ID,
            body: 'Recebemos sua mensagem. A Central responde mensagens prioritárias por email; pra dúvidas rápidas siga as redes oficiais 💚',
            createdAt: new Date().toISOString(),
            senderName: 'Central Ana Castela',
            senderAvatarUrl: FAKE_CENTRAL_AVATAR_URL,
          };
          setCentralMessages((prev) => [...prev, reply]);
        }, ANA_REPLY_DELAY_MS);
        return;
      }

      /* Conversa real — repassa attachments pro base.send (que
       * tem o caminho de socket + REST com a persistência JSONB
       * em messages.attachments). Sem o segundo argumento aqui,
       * a imagem ficava só no preview do composer e a bubble
       * persistia como text-only. */
      return base.send(body, attachments);
    },
    [activeOverride, base, user?.id],
  );

  const openDmWith = useCallback(
    async (otherUserId: string) => {
      if (otherUserId === FAKE_ANA_USER_ID) {
        open(FAKE_ANA_CONVERSATION_ID);
        return;
      }
      if (otherUserId === FAKE_CENTRAL_USER_ID) {
        open(FAKE_CENTRAL_CONVERSATION_ID);
        return;
      }
      return base.openDmWith(otherUserId);
    },
    [base, open],
  );

  const markRead = useCallback(
    async (conversationId: string) => {
      if (conversationId === FAKE_ANA_CONVERSATION_ID) {
        setAnaUnread(0);
        return;
      }
      if (conversationId === FAKE_CENTRAL_CONVERSATION_ID) {
        setCentralUnread(0);
        return;
      }
      return base.markRead(conversationId);
    },
    [base],
  );

  /** Toggle a reaction. For Ana/Central's fake messages this lives in
   *  local state on `*Messages[i].reactions`; for real messages it
   *  delegates to the base hook (socket round-trip). */
  const react = useCallback(
    (messageId: string, emoji: string) => {
      const toggle = (cur: ApiMessageReaction[]): ApiMessageReaction[] => {
        const existing = cur.find((r) => r.emoji === emoji);
        if (existing?.mine) return cur.filter((r) => r.emoji !== emoji);
        if (existing) {
          return cur.map((r) =>
            r.emoji === emoji ? { ...r, mine: true, count: r.count + 1 } : r,
          );
        }
        return [...cur, { emoji, count: 1, mine: true }];
      };

      if (anaMessages.some((m) => m.id === messageId)) {
        setAnaMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, reactions: toggle(m.reactions ?? []) }
              : m,
          ),
        );
        return;
      }
      if (centralMessages.some((m) => m.id === messageId)) {
        setCentralMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, reactions: toggle(m.reactions ?? []) }
              : m,
          ),
        );
        return;
      }
      base.react(messageId, emoji);
    },
    [base, anaMessages, centralMessages],
  );

  const activeId = activeOverride ?? base.activeId;
  const messages =
    activeOverride === FAKE_ANA_CONVERSATION_ID
      ? anaMessages
      : activeOverride === FAKE_CENTRAL_CONVERSATION_ID
        ? centralMessages
        : base.messages;
  const loadingMessages = activeOverride ? false : base.loadingMessages;

  return {
    conversations,
    loadingList: base.loadingList,
    activeId,
    open,
    close,
    messages,
    loadingMessages,
    send,
    react,
    openDmWith,
    createGroup: base.createGroup,
    refreshConversations: base.refreshConversations,
    markRead,
  };
}
