import { z } from 'zod';
import { sendMessage } from '../../chat/messages';
import { userIsInConversation } from '../../chat/queries';
import {
  getReactableConversation,
  toggleReaction,
} from '../../chat/reactions';
import { logger } from '@/server/log';
import {
  joinBucket,
  reactBucket,
  sendBucket,
  typingBucket,
} from '../rateLimit';
import type { AppServer, AppSocket } from '../types';

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(4000),
});

const joinSchema = z.object({
  conversationId: z.string().uuid(),
});

const typingSchema = z.object({
  conversationId: z.string().uuid(),
  isTyping: z.boolean(),
});

// Single emoji (allow multi-codepoint sequences for skin tones, ZWJ, etc.)
// up to 8 codepoints to defend against pasted prose. The picker UI only
// fires curated emoji, but this server-side guard protects against
// arbitrary socket payloads.
const reactSchema = z.object({
  messageId: z.string().uuid(),
  emoji: z.string().min(1).max(32),
});

type Ack = (res: { ok: boolean; error?: string; messageId?: string }) => void;

const room     = (conversationId: string) => `conv:${conversationId}`;
const userRoom = (userId: string)         => `user:${userId}`;

export function registerChatHandlers(io: AppServer, socket: AppSocket): void {
  const userId = socket.data.userId;

  socket.on('chat:join', async (input: unknown, ack?: Ack) => {
    try {
      if (!joinBucket.consume(userId)) {
        return ack?.({ ok: false, error: 'rate_limited' });
      }
      const parsed = joinSchema.safeParse(input);
      if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });

      const ok = await userIsInConversation(userId, parsed.data.conversationId);
      if (!ok) return ack?.({ ok: false, error: 'forbidden' });

      socket.join(room(parsed.data.conversationId));
      ack?.({ ok: true });
    } catch (err) {
      logger.error('realtime.chat.chatjoin-handler', err)
      ack?.({ ok: false, error: 'internal' });
    }
  });

  socket.on('chat:leave', (input: unknown) => {
    try {
      const parsed = joinSchema.safeParse(input);
      if (!parsed.success) return;
      socket.leave(room(parsed.data.conversationId));
    } catch (err) {
      logger.error('realtime.chat.chatleave-handler', err)
    }
  });

  socket.on('chat:send', async (input: unknown, ack?: Ack) => {
    try {
      if (!sendBucket.consume(userId)) {
        return ack?.({ ok: false, error: 'rate_limited' });
      }
      const parsed = sendSchema.safeParse(input);
      if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });

      const inIt = await userIsInConversation(userId, parsed.data.conversationId);
      if (!inIt) return ack?.({ ok: false, error: 'forbidden' });

      const result = await sendMessage(
        parsed.data.conversationId,
        userId,
        parsed.data.body,
      );

      // Broadcast the message body to clients viewing the thread (joined room).
      io.to(room(parsed.data.conversationId)).emit('chat:message', result.message);

      // Poke each recipient's PERSONAL room so unread counts / dock badges
      // refresh even when they haven't opened the conversation yet.
      const mentionedSet = new Set(result.mentionedUserIds);
      for (const recipientId of result.recipientIds) {
        io.to(userRoom(recipientId)).emit('chat:thread:update', {
          conversationId: parsed.data.conversationId,
          lastMessageId: result.message.id,
        });
        // notify:new push paths:
        //   - DMs: every recipient gets a 'message' notify (we
        //     already inserted a notification row server-side).
        //   - Groups: only @-mentioned recipients get a 'mention'
        //     notify (we inserted a 'mention' row for those, and
        //     skipped per-message group notifs to avoid fanout).
        if (result.conversationType === 'dm') {
          io.to(userRoom(recipientId)).emit('notify:new', {
            kind: 'message',
            conversationId: parsed.data.conversationId,
            messageId: result.message.id,
          });
        } else if (mentionedSet.has(recipientId)) {
          io.to(userRoom(recipientId)).emit('notify:new', {
            kind: 'mention',
            conversationId: parsed.data.conversationId,
            messageId: result.message.id,
          });
        }
      }

      ack?.({ ok: true, messageId: result.message.id });
    } catch (err) {
      logger.error('realtime.chat.chatsend-handler', err)
      ack?.({ ok: false, error: 'send_failed' });
    }
  });

  socket.on('chat:typing', (input: unknown) => {
    try {
      // Typing fires on every keystroke from misbehaving clients.
      // Silent drop (no ack) when over budget — UI degrades gracefully.
      if (!typingBucket.consume(userId)) return;
      const parsed = typingSchema.safeParse(input);
      if (!parsed.success) return;
      socket.to(room(parsed.data.conversationId)).emit('chat:typing', {
        conversationId: parsed.data.conversationId,
        userId,
        isTyping: parsed.data.isTyping,
      });
    } catch (err) {
      logger.error('realtime.chat.chattyping-handler', err)
    }
  });

  // Toggle a reaction on a message. The server resolves the message's
  // conversation via a single join that also enforces "user must be a
  // participant" — no separate authz call needed. After the toggle we
  // broadcast the new aggregated list to everyone in the conversation
  // room so chips stay in sync without per-client refetches.
  socket.on(
    'chat:react',
    async (
      input: unknown,
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      try {
        if (!reactBucket.consume(userId)) {
          return ack?.({ ok: false, error: 'rate_limited' });
        }
        const parsed = reactSchema.safeParse(input);
        if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });

        const conversationId = await getReactableConversation(
          userId,
          parsed.data.messageId,
        );
        if (!conversationId) return ack?.({ ok: false, error: 'forbidden' });

        const { action, reactions } = await toggleReaction(
          userId,
          parsed.data.messageId,
          parsed.data.emoji,
        );

        io.to(room(conversationId)).emit('chat:reaction', {
          conversationId,
          messageId: parsed.data.messageId,
          emoji: parsed.data.emoji,
          action,
          actorUserId: userId,
          reactions,
        });

        ack?.({ ok: true });
      } catch (err) {
        logger.error('realtime.chat.chatreact-handler', err)
        ack?.({ ok: false, error: 'react_failed' });
      }
    },
  );
}
