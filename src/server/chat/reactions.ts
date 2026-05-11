import { and, eq, sql } from 'drizzle-orm';
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
     AND cp.user_id = ${userId}::uuid
    WHERE m.id = ${messageId}::uuid
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
      BOOL_OR(user_id = ${userId}::uuid) AS mine,
      MIN(created_at)                    AS first_seen
    FROM message_reactions
    WHERE message_id = ${messageId}::uuid
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
 *
 * Uses raw SQL with explicit ::uuid casts because mixing the typed
 * Drizzle query builder with parameter bindings for uuid comparisons
 * inside aggregates (BOOL_OR) was generating SQL that Postgres
 * rejected with ambiguous types — taking the /api/superchat GET to
 * a 500. The single-message variant above uses the same raw style
 * and has been working reliably from the socket path.
 */
export async function listReactionsForMessages(
  userId: string,
  messageIds: string[],
): Promise<Map<string, ReactionAggregation[]>> {
  const out = new Map<string, ReactionAggregation[]>();
  if (messageIds.length === 0) return out;

  const rows = await db.execute(sql`
    SELECT
      message_id,
      emoji,
      COUNT(*)::int  AS count,
      BOOL_OR(user_id = ${userId}::uuid) AS mine,
      MIN(created_at) AS first_seen
    FROM message_reactions
    WHERE message_id = ANY(${messageIds}::uuid[])
    GROUP BY message_id, emoji
    ORDER BY message_id, first_seen
  `);

  for (const r of rows.rows) {
    const mid = r.message_id as string;
    const arr = out.get(mid) ?? [];
    arr.push({
      emoji: r.emoji as string,
      count: r.count as number,
      mine: r.mine as boolean,
    });
    out.set(mid, arr);
  }
  return out;
}
