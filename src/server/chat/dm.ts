import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { conversationParticipants, conversations, users } from '../db/schema';

/**
 * Get the existing 1-on-1 DM between two users, or create one.
 * Returns the conversation id. Idempotent: same pair always resolves to the
 * same conversation, regardless of the call order of A,B vs B,A.
 */
export async function getOrCreateDm(
  userIdA: string,
  userIdB: string,
): Promise<{ id: string; created: boolean }> {
  if (userIdA === userIdB) {
    throw new Error('cannot create DM with self');
  }

  // Look for an existing DM that has *exactly* these two participants.
  const existing = await db.execute(sql`
    SELECT c.id
    FROM conversations c
    WHERE c.type = 'dm'
      AND EXISTS (
        SELECT 1 FROM conversation_participants p
        WHERE p.conversation_id = c.id AND p.user_id = ${userIdA}
      )
      AND EXISTS (
        SELECT 1 FROM conversation_participants p
        WHERE p.conversation_id = c.id AND p.user_id = ${userIdB}
      )
      AND (
        SELECT COUNT(*)::int FROM conversation_participants p
        WHERE p.conversation_id = c.id
      ) = 2
    LIMIT 1
  `);

  const found = existing.rows[0]?.id as string | undefined;
  if (found) return { id: found, created: false };

  // Create a new DM. Must be transactional so the conversation row + both
  // participant rows go in atomically.
  return await db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversations)
      .values({ type: 'dm' })
      .returning({ id: conversations.id });

    await tx.insert(conversationParticipants).values([
      { conversationId: conv.id, userId: userIdA },
      { conversationId: conv.id, userId: userIdB },
    ]);

    return { id: conv.id, created: true };
  });
}

/** Verify a user exists by id (for DM creation guards). */
export async function userExists(userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql`1` })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows.length > 0;
}

/** Auto-join a user to the Superchat group conversation. Idempotent. */
export async function ensureSuperchatMembership(userId: string): Promise<void> {
  const superchat = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.slug, 'superchat'))
    .limit(1);
  if (!superchat[0]) return;

  await db
    .insert(conversationParticipants)
    .values({ conversationId: superchat[0].id, userId })
    .onConflictDoNothing({
      target: [conversationParticipants.conversationId, conversationParticipants.userId],
    });
}

/** Get the Superchat conversation row (or null if not seeded). */
export async function getSuperchat() {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.type, 'group'), eq(conversations.slug, 'superchat')))
    .limit(1);
  return rows[0] ?? null;
}
