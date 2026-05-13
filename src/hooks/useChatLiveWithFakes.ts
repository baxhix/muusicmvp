'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiConversationSummary, ApiMessage } from '@/lib/api/types';
import {
  FAKE_ANA_CONVERSATION_ID,
  FAKE_ANA_USER_ID,
  buildAnaConversation,
  buildInitialAnaMessages,
  pickRandomAnaMessage,
  pickRandomAnaReply,
} from '@/lib/fakeAna';
import { useAuth } from '@/lib/auth/AuthContext';
import { useChatLive } from './useChatLive';

/** Cadence at which Ana auto-posts a new "I'm online" message. */
const ANA_AUTO_INTERVAL_MS = 2 * 60 * 1000;

/** Delay after a fan replies before Ana sends a canned thank-you. */
const ANA_REPLY_DELAY_MS = 2_500;

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

  // Fake conversation state — owned entirely by this wrapper.
  const [anaMessages, setAnaMessages] = useState<ApiMessage[]>(() =>
    buildInitialAnaMessages(),
  );
  // `activeOverride` flips on when the fan opens Ana's thread. While
  // it's set, the wrapper short-circuits open/close/send/messages.
  const [activeOverride, setActiveOverride] = useState<string | null>(null);
  // Unread badge tracking for the fake conversation. Reset to 0 the
  // moment the fan opens her thread; goes up when a new auto-message
  // lands while she's NOT actively viewing it.
  const [anaUnread, setAnaUnread] = useState(0);

  // Keep a ref of "is Ana's thread the active one?" so the auto-post
  // interval can avoid bumping unread when the user is already
  // watching her messages stream in.
  const isAnaActiveRef = useRef(false);
  isAnaActiveRef.current = activeOverride === FAKE_ANA_CONVERSATION_ID;

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

  // ── Merged conversation list ────────────────────────────────────
  const anaConv = useMemo<ApiConversationSummary>(
    () =>
      buildAnaConversation({
        lastMessage: anaMessages[anaMessages.length - 1] ?? null,
        unreadCount: anaUnread,
      }),
    [anaMessages, anaUnread],
  );

  const conversations = useMemo<ApiConversationSummary[]>(() => {
    // Pin Ana at the top — she's the artist, she always gets the
    // hero slot in the dock. Real conversations follow in their
    // server-side order.
    return [anaConv, ...base.conversations];
  }, [anaConv, base.conversations]);

  // ── Override open/close/send for the fake thread ────────────────
  const open = useCallback(
    (conversationId: string) => {
      if (conversationId === FAKE_ANA_CONVERSATION_ID) {
        // Close any real conversation that might be open, then mark
        // Ana's as active locally + zero the unread count.
        if (base.activeId) base.close();
        setActiveOverride(FAKE_ANA_CONVERSATION_ID);
        setAnaUnread(0);
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
    async (body: string) => {
      const text = body.trim();
      if (!text) return;

      if (activeOverride === FAKE_ANA_CONVERSATION_ID) {
        // Append the fan's message locally — same shape as a real
        // ApiMessage so MessageBody/quote/link previews all work.
        const fanMsg: ApiMessage = {
          id: `fake-ana-fan-${Date.now()}`,
          conversationId: FAKE_ANA_CONVERSATION_ID,
          senderId: user?.id ?? '',
          body: text,
          createdAt: new Date().toISOString(),
        };
        setAnaMessages((prev) => [...prev, fanMsg]);
        // Canned reply on a short delay so the conversation feels
        // alive. Fires-and-forgets — no error path.
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
          // Don't bump unread — the fan is by definition viewing
          // the thread right now (otherwise send wouldn't have
          // been called).
        }, ANA_REPLY_DELAY_MS);
        return;
      }

      return base.send(body);
    },
    [activeOverride, base, user?.id],
  );

  const openDmWith = useCallback(
    async (otherUserId: string) => {
      if (otherUserId === FAKE_ANA_USER_ID) {
        open(FAKE_ANA_CONVERSATION_ID);
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
      return base.markRead(conversationId);
    },
    [base],
  );

  const activeId = activeOverride ?? base.activeId;
  const messages =
    activeOverride === FAKE_ANA_CONVERSATION_ID ? anaMessages : base.messages;
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
    openDmWith,
    markRead,
  };
}
