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

const room = (conversationId: string) => `conv:${conversationId}`;

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
      const message = await sendMessage(
        parsed.data.conversationId,
        userId,
        parsed.data.body,
      );

      io.to(room(parsed.data.conversationId)).emit('chat:message', message);

      // Push 'message' notifications to DM recipients in real-time
      // (the DB rows were already inserted by sendMessage; this just nudges UIs).
      io.to(room(parsed.data.conversationId)).emit('notify:peek', {
        kind: 'message',
        conversationId: parsed.data.conversationId,
        messageId: message.id,
      });

      ack?.({ ok: true, messageId: message.id });
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
