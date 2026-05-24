import { and, desc, eq, lt, sql } from 'drizzle-orm';
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
export async function listConversationsForUser(userId: string) {
  const rows = await db.execute(sql`
    WITH user_convs AS (
      SELECT conversation_id, last_read_message_id, role
      FROM conversation_participants
      WHERE user_id = ${userId}
    ),
    last_msg AS (
      SELECT DISTINCT ON (conversation_id)
        conversation_id, id, body, sender_id, created_at
      FROM messages
      WHERE conversation_id IN (SELECT conversation_id FROM user_convs)
      ORDER BY conversation_id, created_at DESC
    )
    SELECT
      c.id              AS conversation_id,
      c.type            AS conversation_type,
      c.name            AS conversation_name,
      c.image_url       AS conversation_image_url,
      c.created_by      AS conversation_created_by,
      c.created_at      AS conversation_created_at,
      uc.role           AS my_role,
      lm.id             AS last_message_id,
      lm.body           AS last_message_body,
      lm.sender_id      AS last_message_sender_id,
      lm.created_at     AS last_message_created_at,
      other.id          AS other_user_id,
      other.name        AS other_user_name,
      other.avatar_url  AS other_user_avatar,
      -- Cheap count for the dock badge — exact participants list is
      -- fetched on demand from /api/conversations/:id/members.
      (
        SELECT COUNT(*)::int FROM conversation_participants cpc
        WHERE cpc.conversation_id = c.id
      ) AS member_count,
      (
        SELECT COUNT(*)::int FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> ${userId}
          AND (
            uc.last_read_message_id IS NULL
            OR m.created_at > (
              SELECT created_at FROM messages WHERE id = uc.last_read_message_id
            )
          )
      ) AS unread_count
    FROM conversations c
    JOIN user_convs uc ON uc.conversation_id = c.id
    LEFT JOIN last_msg lm ON lm.conversation_id = c.id
    LEFT JOIN LATERAL (
      SELECT u.id, u.name, u.avatar_url
      FROM conversation_participants cp2
      JOIN users u ON u.id = cp2.user_id
      WHERE cp2.conversation_id = c.id AND cp2.user_id <> ${userId}
      LIMIT 1
    ) AS other ON TRUE
    ORDER BY COALESCE(lm.created_at, c.created_at) DESC
  `);

  return rows.rows.map((r) => ({
    id: r.conversation_id as string,
    type: r.conversation_type as 'dm' | 'group',
    name: (r.conversation_name as string | null) ?? null,
    imageUrl: (r.conversation_image_url as string | null) ?? null,
    createdBy: (r.conversation_created_by as string | null) ?? null,
    createdAt: r.conversation_created_at as Date,
    myRole: r.my_role as 'owner' | 'admin' | 'member',
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
 * Mark the conversation read up to its latest message for the given user.
 * Idempotent — sets `last_read_message_id` to the most recent message id.
 */
export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE conversation_participants
    SET last_read_message_id = (
      SELECT id FROM messages
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at DESC
      LIMIT 1
    )
    WHERE conversation_id = ${conversationId}
      AND user_id = ${userId}
  `);
}

/** Returns true if the user is a participant of the conversation. */
export async function userIsInConversation(
  userId: string,
  conversationId: string,
): Promise<boolean> {
  const row = await db
    .select({ x: sql`1` })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
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
