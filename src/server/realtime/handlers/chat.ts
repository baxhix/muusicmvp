import { z } from 'zod';
import { sendMessage } from '../../chat/messages';
import { userIsInConversation } from '../../chat/queries';
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

type Ack = (res: { ok: boolean; error?: string; messageId?: string }) => void;

const room     = (conversationId: string) => `conv:${conversationId}`;
const userRoom = (userId: string)         => `user:${userId}`;

export function registerChatHandlers(io: AppServer, socket: AppSocket): void {
  const userId = socket.data.userId;

  socket.on('chat:join', async (input: unknown, ack?: Ack) => {
    const parsed = joinSchema.safeParse(input);
    if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });

    const ok = await userIsInConversation(userId, parsed.data.conversationId);
    if (!ok) return ack?.({ ok: false, error: 'forbidden' });

    socket.join(room(parsed.data.conversationId));
    ack?.({ ok: true });
  });

  socket.on('chat:leave', (input: unknown) => {
    const parsed = joinSchema.safeParse(input);
    if (!parsed.success) return;
    socket.leave(room(parsed.data.conversationId));
  });

  socket.on('chat:send', async (input: unknown, ack?: Ack) => {
    const parsed = sendSchema.safeParse(input);
    if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });

    const inIt = await userIsInConversation(userId, parsed.data.conversationId);
    if (!inIt) return ack?.({ ok: false, error: 'forbidden' });

    try {
      const result = await sendMessage(
        parsed.data.conversationId,
        userId,
        parsed.data.body,
      );

      // Broadcast the message body to clients viewing the thread (joined room).
      io.to(room(parsed.data.conversationId)).emit('chat:message', result.message);

      // Poke each recipient's PERSONAL room so unread counts / dock badges
      // refresh even when they haven't opened the conversation yet.
      for (const recipientId of result.recipientIds) {
        io.to(userRoom(recipientId)).emit('chat:thread:update', {
          conversationId: parsed.data.conversationId,
          lastMessageId: result.message.id,
        });
        // Also wake up the notifications hook for DMs (where we did insert
        // notification rows).
        if (result.conversationType === 'dm') {
          io.to(userRoom(recipientId)).emit('notify:new', {
            kind: 'message',
            conversationId: parsed.data.conversationId,
            messageId: result.message.id,
          });
        }
      }

      ack?.({ ok: true, messageId: result.message.id });
    } catch {
      ack?.({ ok: false, error: 'send_failed' });
    }
  });

  socket.on('chat:typing', (input: unknown) => {
    const parsed = typingSchema.safeParse(input);
    if (!parsed.success) return;
    socket.to(room(parsed.data.conversationId)).emit('chat:typing', {
      conversationId: parsed.data.conversationId,
      userId,
      isTyping: parsed.data.isTyping,
    });
  });
}
