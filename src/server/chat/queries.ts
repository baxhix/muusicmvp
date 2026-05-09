import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { conversationParticipants, messages } from '../db/schema';

/**
 * List the current user's DMs with their last message and the "other" participant.
 * Newest activity first. Empty conversations are still returned (lastMessage = null).
 */
export async function listConversationsForUser(userId: string) {
  const rows = await db.execute(sql`
    WITH user_convs AS (
      SELECT conversation_id FROM conversation_participants WHERE user_id = ${userId}
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
      c.created_at      AS conversation_created_at,
      lm.id             AS last_message_id,
      lm.body           AS last_message_body,
      lm.sender_id      AS last_message_sender_id,
      lm.created_at     AS last_message_created_at,
      other.id          AS other_user_id,
      other.name        AS other_user_name,
      other.avatar_url  AS other_user_avatar
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
    createdAt: r.conversation_created_at as Date,
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
  }));
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
 */
export async function listMessages(
  conversationId: string,
  opts: { limit?: number; before?: Date } = {},
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
    })
    .from(messages)
    .where(where)
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  return { messages: rows.slice(0, limit), hasMore };
}
