import { z } from 'zod';
import { sendMessage } from '../../chat/messages';
import { markConversationRead, userIsInConversation } from '../../chat/queries';
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

/* Attachment shape espelhando `MessageAttachment` (server/chat/messages.ts).
 * URL precisa começar com /api/chat/images/ — `normalizeAttachments`
 * faz a checagem final no momento do INSERT, mas validar aqui dá
 * feedback rápido pro client. */
const attachmentSchema = z.object({
  url: z.string().startsWith('/api/chat/images/').max(300),
  mimeType: z.string().max(80),
  size: z.number().int().min(0).max(8 * 1024 * 1024),
  width: z.number().int().min(1).max(20_000).nullable().optional(),
  height: z.number().int().min(1).max(20_000).nullable().optional(),
});

const sendSchema = z.object({
  conversationId: z.string().uuid(),
  /* body pode ser vazio QUANDO houver attachments — a regra
   * "uma das duas" é aplicada no `sendMessage()` server-side
   * (throw 'empty_message' se ambos vazios). Aqui só validamos
   * tamanho máximo. */
  body: z.string().max(4000),
  attachments: z.array(attachmentSchema).max(6).optional(),
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

const readSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
});

type Ack = (res: { ok: boolean; error?: string; messageId?: string }) => void;

const room     = (conversationId: string) => `conv:${conversationId}`;
const userRoom = (userId: string)         => `user:${userId}`;

/* P1.4: dedupe de chat:typing por (userId, conversationId) com
 * TTL curto. Mesmo que o cliente emita a cada keystroke (legacy),
 * o server agrupa em janelas de 1500ms — o broadcast pros outros
 * clientes só dispara 1× por janela. Reduz network noise drástica
 * em grupos ativos (N membros × M keystrokes/s = N×M broadcasts).
 *
 * Map em memória é OK enquanto o realtime é single-process; ao
 * mover pro Redis adapter (P2.5) precisa migrar pra cache compartilhado. */
const TYPING_DEDUPE_WINDOW_MS = 1500;
const typingLastEmit = new Map<string, number>();
function typingKey(userId: string, convId: string, isTyping: boolean): string {
  return `${userId}:${convId}:${isTyping ? '1' : '0'}`;
}

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
      logger.info('realtime.chat.joined', {
        userId,
        conversationId: parsed.data.conversationId,
      });
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

      /* DEBUG temporário: registra o que veio do cliente pra debug
       * do "imagem não aparece" — remover quando o bug for resolvido. */
      logger.info('realtime.chat.send.input', {
        userId,
        conversationId: parsed.data.conversationId,
        bodyLength: parsed.data.body.length,
        attachmentsLength: parsed.data.attachments?.length ?? 0,
        attachmentsSample: parsed.data.attachments?.[0]
          ? { url: parsed.data.attachments[0].url, size: parsed.data.attachments[0].size }
          : null,
      });

      const result = await sendMessage(
        parsed.data.conversationId,
        userId,
        parsed.data.body,
        parsed.data.attachments ?? null,
      );

      logger.info('realtime.chat.send.result', {
        messageId: result.message.id,
        attachmentsLength: result.message.attachments?.length ?? 0,
      });

      // Broadcast the message body to clients viewing the thread (joined room).
      io.to(room(parsed.data.conversationId)).emit('chat:message', result.message);

      // Poke each recipient's PERSONAL room so unread counts / dock badges
      // refresh even when they haven't opened the conversation yet.
      //
      // Payload enriquecido com `senderName`, `senderAvatarUrl` e
      // `snippet` (truncado em 80 chars) pra que recipients que NÃO
      // estão joined em room(convId) — caso comum: conv não aberta —
      // consigam montar o toast "X enviou uma mensagem" no
      // MockToastRotator sem precisar de round-trip extra.
      const mentionedSet = new Set(result.mentionedUserIds);
      const snippet =
        result.message.body.length > 80
          ? `${result.message.body.slice(0, 80)}…`
          : result.message.body;
      for (const recipientId of result.recipientIds) {
        io.to(userRoom(recipientId)).emit('chat:thread:update', {
          conversationId: parsed.data.conversationId,
          lastMessageId: result.message.id,
          senderId: result.message.senderId,
          senderName: result.message.senderName,
          senderAvatarUrl: result.message.senderAvatarUrl,
          snippet,
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

      /* P2.8: log estruturado pra extrair métricas tipo
       * messages_sent_total + p50 de tamanho de body + ratio
       * dm vs group. Não inclui body por privacidade. */
      logger.info('realtime.chat.sent', {
        userId,
        conversationId: parsed.data.conversationId,
        conversationType: result.conversationType,
        bodyLength: parsed.data.body.length,
        recipientCount: result.recipientIds.length,
        mentionCount: result.mentionedUserIds.length,
      });

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

      /* P1.4: dedupe por (userId, conversationId, isTyping) com
       * janela TTL. Mesmo state em <1500ms = no-op. Reduz fan-out
       * de N×M broadcasts em grupos ativos. */
      const key = typingKey(userId, parsed.data.conversationId, parsed.data.isTyping);
      const now = Date.now();
      const last = typingLastEmit.get(key) ?? 0;
      if (now - last < TYPING_DEDUPE_WINDOW_MS) return;
      typingLastEmit.set(key, now);

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
  /* P1.5: chat:read via socket. Antes era só POST /read; agora
   * o evento socket faz o UPDATE + broadcast pro userRoom do
   * próprio user. Sessões secundárias (outra aba, outro device)
   * recebem o broadcast e zeram o badge local sem precisar de
   * polling. POST /read continua válido como fallback REST. */
  socket.on(
    'chat:read',
    async (
      input: unknown,
      ack?: (res: { ok: boolean; error?: string }) => void,
    ) => {
      try {
        const parsed = readSchema.safeParse(input);
        if (!parsed.success) return ack?.({ ok: false, error: 'invalid_payload' });

        const inIt = await userIsInConversation(userId, parsed.data.conversationId);
        if (!inIt) return ack?.({ ok: false, error: 'forbidden' });

        await markConversationRead(
          parsed.data.conversationId,
          userId,
          { messageId: parsed.data.messageId },
        );

        // Broadcast pra TODAS as sessions do user (incluindo essa) —
        // cada cliente decide se atualiza ou ignora baseado no seu
        // próprio estado local.
        io.to(userRoom(userId)).emit('chat:read', {
          conversationId: parsed.data.conversationId,
          messageId: parsed.data.messageId,
        });

        logger.info('realtime.chat.read', {
          userId,
          conversationId: parsed.data.conversationId,
        });

        ack?.({ ok: true });
      } catch (err) {
        logger.error('realtime.chat.chatread-handler', err);
        ack?.({ ok: false, error: 'read_failed' });
      }
    },
  );

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

        logger.info('realtime.chat.reacted', {
          userId,
          conversationId,
          messageId: parsed.data.messageId,
          emoji: parsed.data.emoji,
          action,
        });

        ack?.({ ok: true });
      } catch (err) {
        logger.error('realtime.chat.chatreact-handler', err)
        ack?.({ ok: false, error: 'react_failed' });
      }
    },
  );
}
