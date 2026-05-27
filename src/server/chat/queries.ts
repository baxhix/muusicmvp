import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { conversationParticipants, messages, users } from '../db/schema';
import { listReactionsForMessages } from './reactions';
import { logger } from '@/server/log';

/**
 * List the current user's DMs with their last message, the "other" participant,
 * and an `unreadCount` of messages received since this user's last read marker.
 *
 * Unread is computed as: count of messages in the conversation NOT sent by the
 * current user AND newer than `cp.last_read_message_id` (or all of them if the
 * marker is null). The dock-style chat avatars use this to render a red badge.
 */
/**
 * Lista as conversas do user.
 *
 * P0.2 da auditoria de chat: query agora lê APENAS dos contadores
 * denormalizados (`conversations.last_message_*`, `member_count`,
 * `conversation_participants.unread_count`) — sem subqueries
 * correlacionadas. Performance vai de O(N × M) (N convs × M
 * mensagens cada via DISTINCT ON) pra O(N) com index range scan.
 *
 * Ainda buscamos o `last_message_body` + `sender_id` via LEFT JOIN
 * em `messages.id = c.last_message_id` (lookup PK O(1), uma vez por
 * conversa). Isso preserva o preview "última mensagem" no dock sem
 * voltar a varrer a tabela.
 *
 * Paginação opcional via `before` (cursor por last_message_at DESC)
 * + `limit`. Default 100 — cobre 99% dos users (poucos têm > 100
 * conversas ativas). Quando vier o frame de "ver mais", o cliente
 * passa o último `last_message_at` que recebeu.
 */
export async function listConversationsForUser(
  userId: string,
  opts: { limit?: number; before?: Date } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  const cursor = opts.before
    ? sql`AND COALESCE(c.last_message_at, c.created_at) < ${opts.before.toISOString()}`
    : sql``;
  const rows = await db.execute(sql`
    SELECT
      c.id              AS conversation_id,
      c.type            AS conversation_type,
      c.name            AS conversation_name,
      c.image_url       AS conversation_image_url,
      c.created_by      AS conversation_created_by,
      c.created_at      AS conversation_created_at,
      c.member_count    AS member_count,
      c.last_message_id AS last_message_id,
      c.last_message_at AS last_message_created_at,
      uc.role           AS my_role,
      uc.left_at        AS my_left_at,
      uc.unread_count   AS unread_count,
      lm.body           AS last_message_body,
      lm.sender_id      AS last_message_sender_id,
      other.id          AS other_user_id,
      other.name        AS other_user_name,
      other.avatar_url  AS other_user_avatar
    FROM conversations c
    JOIN conversation_participants uc ON uc.conversation_id = c.id AND uc.user_id = ${userId}
    /* Lookup PK no messages.id — único lookup por conversa pra
     * trazer o preview body/sender. PK index = O(1). */
    LEFT JOIN messages lm ON lm.id = c.last_message_id
    LEFT JOIN LATERAL (
      SELECT u.id, u.name, u.avatar_url
      FROM conversation_participants cp2
      JOIN users u ON u.id = cp2.user_id
      WHERE cp2.conversation_id = c.id AND cp2.user_id <> ${userId}
      LIMIT 1
    ) AS other ON TRUE
    /* "Apagar conversa pra mim": conversas com hidden_at ficam de
     * fora — exceto quando a outra parte mandou mensagem NOVA
     * (last_message_at > hidden_at), aí a conversa re-aparece. */
    WHERE (uc.hidden_at IS NULL
       OR (c.last_message_at IS NOT NULL AND c.last_message_at > uc.hidden_at))
    ${cursor}
    ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    LIMIT ${limit}
  `);

  return rows.rows.map((r) => ({
    id: r.conversation_id as string,
    type: r.conversation_type as 'dm' | 'group',
    name: (r.conversation_name as string | null) ?? null,
    imageUrl: (r.conversation_image_url as string | null) ?? null,
    createdBy: (r.conversation_created_by as string | null) ?? null,
    createdAt: r.conversation_created_at as Date,
    myRole: r.my_role as 'owner' | 'admin' | 'member',
    /* Quando setado, o front renderiza o grupo em modo read-only +
     * banner "Você saiu do grupo e não pode mais enviar mensagens". */
    myLeftAt: (r.my_left_at as Date | null) ?? null,
    memberCount: (r.member_count as number) ?? 0,
    lastMessage: r.last_message_id
      ? {
          id: r.last_message_id as string,
          body: r.last_message_body as string,
          senderId: r.last_message_sender_id as string,
          createdAt: r.last_message_created_at as Date,
        }
      : null,
    otherUser: r.other_user_id
      ? {
          id: r.other_user_id as string,
          name: r.other_user_name as string | null,
          avatarUrl: r.other_user_avatar as string | null,
        }
      : null,
    unreadCount: r.unread_count as number,
  }));
}

/**
 * "Apagar conversa pra mim" — soft-hide por participante.
 *
 * Seta `hidden_at = now()` na row do `conversation_participants` do
 * user. listConversationsForUser passa a filtrar conversas com
 * `hidden_at IS NOT NULL` EXCETO quando uma mensagem nova chegou
 * depois (created_at > hidden_at) — aí a conversa re-aparece.
 *
 * Não afeta a outra parte: ela continua vendo a conversa intacta
 * com todo o histórico. É operação local do user.
 *
 * Retorna `false` se o user não é participante (404 mapping fica
 * com a route).
 */
export async function hideConversationForUser(
  conversationId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(conversationParticipants)
    .set({ hiddenAt: new Date() })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .returning({ userId: conversationParticipants.userId });
  return result.length > 0;
}

/**
 * Mark the conversation read up to its latest message for the given user.
 * Idempotent — sets `last_read_message_id` to the most recent message id
 * AND zera o `unread_count` denormalizado (P0.2).
 *
 * O reset do counter é o passo crítico: sem isso o badge vermelho do
 * dock continuaria mostrando o número antigo até a próxima mensagem
 * (que disparava recálculo via subquery — agora eliminada).
 */
export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE conversation_participants
    SET
      last_read_message_id = (
        SELECT id FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at DESC
        LIMIT 1
      ),
      unread_count = 0
    WHERE conversation_id = ${conversationId}
      AND user_id = ${userId}
  `);
}

/** Returns true if the user is a participant of the conversation.
 *
 *  Use `requireActive: true` pra exigir que o user esteja ATIVO
 *  (leftAt IS NULL) — necessário pra POST /messages, mas não pra
 *  GET. Usuários que SAÍRAM continuam podendo LER o histórico em
 *  modo read-only, mas não postam nem reagem. */
export async function userIsInConversation(
  userId: string,
  conversationId: string,
  opts: { requireActive?: boolean } = {},
): Promise<boolean> {
  const where = opts.requireActive
    ? and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
        isNull(conversationParticipants.leftAt),
      )
    : and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      );

  const row = await db
    .select({ x: sql`1` })
    .from(conversationParticipants)
    .where(where)
    .limit(1);
  return row.length > 0;
}

/**
 * Page messages of a conversation, newest first.
 * Use `before` (timestamp) to fetch the next older page.
 *
 * Pass `viewerId` when you want each message hydrated with its
 * aggregated reactions list (and a `mine` flag per emoji). Skipped
 * when the caller doesn't pass a viewer — keeps the query light
 * for paths that don't render reactions.
 */
export async function listMessages(
  conversationId: string,
  opts: { limit?: number; before?: Date; viewerId?: string } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const where = opts.before
    ? and(
        eq(messages.conversationId, conversationId),
        lt(messages.createdAt, opts.before),
      )
    : eq(messages.conversationId, conversationId);

  const rows = await db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      body: messages.body,
      createdAt: messages.createdAt,
      // Discriminator for system events ('system_created' /
      // 'system_join' / etc.). 'user' for typed messages — the
      // front-end renders the system kinds as centered pills.
      kind: messages.kind,
      // Sender hydration for multi-user rooms (Superchat): each message
      // arrives with the sender's display name + avatar so the UI can
      // render 'who said this' without a per-message lookup.
      senderName: users.name,
      senderEmail: users.email,
      senderAvatarUrl: users.avatarUrl,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.senderId))
    .where(where)
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  // Hydrate aggregated reactions per message so the UI can render
  // them on initial load — previously this only happened for the
  // Superchat path, and DM reactions disappeared when the user left
  // and re-entered the conversation.
  //
  // DEFENSIVE: any failure inside listReactionsForMessages must NOT
  // break message delivery. Wrap in try/catch and fall through to
  // the no-reactions branch so the conversation history always
  // renders even if reaction queries hit some edge case.
  if (opts.viewerId && page.length > 0) {
    try {
      const reactionsByMsg = await listReactionsForMessages(
        opts.viewerId,
        page.map((m) => m.id),
      );
      return {
        messages: page.map((m) => ({
          ...m,
          reactions: reactionsByMsg.get(m.id) ?? [],
        })),
        hasMore,
      };
    } catch (err) {
      // Log but don't propagate — the conversation history is
      // far more important than the reactions chips.
      logger.error('chat.listmessages-reaction-hydration', err)
    }
  }

  // Always provide reactions=[] when viewerId was passed so the
  // client doesn't see a different shape between success/failure.
  if (opts.viewerId) {
    return {
      messages: page.map((m) => ({ ...m, reactions: [] })),
      hasMore,
    };
  }

  return { messages: page, hasMore };
}
