import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { messageReactions } from '../db/schema';

/**
 * Aggregated reaction row returned to clients. One per (message, emoji)
 * pair. `mine` flips when the requesting user is one of the reactors.
 */
export interface ReactionAggregation {
  emoji: string;
  count: number;
  mine: boolean;
}

/**
 * Look up the conversation that owns a message, but ONLY if the given
 * user is a participant of that conversation. Returns the conversation
 * id on success, or null when the message doesn't exist or the user
 * isn't allowed to interact with it.
 *
 * Used as the auth gate before mutating reactions over the socket.
 */
export async function getReactableConversation(
  userId: string,
  messageId: string,
): Promise<string | null> {
  const rows = await db.execute(sql`
    SELECT m.conversation_id
    FROM messages m
    JOIN conversation_participants cp
      ON cp.conversation_id = m.conversation_id
     AND cp.user_id = ${userId}
    WHERE m.id = ${messageId}
    LIMIT 1
  `);
  return (rows.rows[0]?.conversation_id as string | undefined) ?? null;
}

/**
 * Toggle a reaction. Idempotent — if the (message, user, emoji) row
 * exists it's deleted; otherwise a new row is inserted. Returns the
 * resulting aggregated list along with the action taken so callers
 * can broadcast a small delta to other clients.
 */
export async function toggleReaction(
  userId: string,
  messageId: string,
  emoji: string,
): Promise<{
  action: 'added' | 'removed';
  reactions: ReactionAggregation[];
}> {
  // Attempt delete first — if a row is removed we know the user already
  // had this reaction. Otherwise insert it. Using two queries instead of
  // an upsert because the toggle semantics don't map cleanly to ON
  // CONFLICT DO UPDATE.
  const deleted = await db
    .delete(messageReactions)
    .where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, emoji),
      ),
    )
    .returning({ id: messageReactions.id });

  const action: 'added' | 'removed' = deleted.length > 0 ? 'removed' : 'added';

  if (action === 'added') {
    // The unique constraint guards against double-insert in race
    // conditions; onConflictDoNothing keeps the call idempotent.
    await db
      .insert(messageReactions)
      .values({ messageId, userId, emoji })
      .onConflictDoNothing({
        target: [
          messageReactions.messageId,
          messageReactions.userId,
          messageReactions.emoji,
        ],
      });
  }

  const reactions = await listReactionsForMessage(userId, messageId);
  return { action, reactions };
}

/**
 * Aggregated reactions for one message, ordered by the first time each
 * emoji appeared on this message. The deterministic ordering keeps the
 * chip layout stable as users add/remove reactions.
 */
export async function listReactionsForMessage(
  userId: string,
  messageId: string,
): Promise<ReactionAggregation[]> {
  const rows = await db.execute(sql`
    SELECT
      emoji,
      COUNT(*)::int AS count,
      BOOL_OR(user_id = ${userId}) AS mine,
      MIN(created_at)              AS first_seen
    FROM message_reactions
    WHERE message_id = ${messageId}
    GROUP BY emoji
    ORDER BY first_seen
  `);
  return rows.rows.map((r) => ({
    emoji: r.emoji as string,
    count: r.count as number,
    mine: r.mine as boolean,
  }));
}

/**
 * Batch variant for hydrating a list of messages in one query. Returns
 * a Map keyed by messageId — messages with no reactions are not present
 * in the map (caller can default to []).
 */
export async function listReactionsForMessages(
  userId: string,
  messageIds: string[],
): Promise<Map<string, ReactionAggregation[]>> {
  const out = new Map<string, ReactionAggregation[]>();
  if (messageIds.length === 0) return out;

  const rows = await db
    .select({
      messageId: messageReactions.messageId,
      emoji: messageReactions.emoji,
      count: sql<number>`COUNT(*)::int`,
      mine: sql<boolean>`BOOL_OR(${messageReactions.userId} = ${userId})`,
      firstSeen: sql<Date>`MIN(${messageReactions.createdAt})`,
    })
    .from(messageReactions)
    .where(inArray(messageReactions.messageId, messageIds))
    .groupBy(messageReactions.messageId, messageReactions.emoji);

  // Stable per-message ordering by firstSeen — same intent as the
  // single-message variant above.
  rows.sort((a, b) => {
    if (a.messageId !== b.messageId) return 0;
    return a.firstSeen.getTime() - b.firstSeen.getTime();
  });

  for (const r of rows) {
    const arr = out.get(r.messageId) ?? [];
    arr.push({ emoji: r.emoji, count: r.count, mine: r.mine });
    out.set(r.messageId, arr);
  }
  return out;
}
