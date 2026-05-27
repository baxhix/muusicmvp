import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { conversationParticipants, conversations, users } from '../db/schema';
import { recordActivity } from '../activities/queries';

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
  if (found) {
    /* Bug 1 fix: se o caller (userIdA) tinha apagado essa conversa
     * (hidden_at != null), reabri-la pelo /search → openDmWith
     * deve trazê-la de volta pra lista. Limpamos APENAS o
     * `hidden_at` — `cleared_history_before` (introduzido em 0041)
     * permanece, mantendo o histórico anterior ao apagamento
     * oculto. Resultado: conversa reaparece na lista, mas só as
     * mensagens posteriores ao clear ficam visíveis pra esse user.
     *
     * Outra parte (userIdB) NÃO é afetada — preserva o histórico
     * dela conforme o produto pediu. */
    await db
      .update(conversationParticipants)
      .set({ hiddenAt: null })
      .where(
        and(
          eq(conversationParticipants.conversationId, found),
          eq(conversationParticipants.userId, userIdA),
        ),
      );
    return { id: found, created: false };
  }

  // Create a new DM. Must be transactional so the conversation row + both
  // participant rows go in atomically.
  const result = await db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversations)
      .values({ type: 'dm' })
      .returning({ id: conversations.id });

    await tx.insert(conversationParticipants).values([
      { conversationId: conv.id, userId: userIdA },
      { conversationId: conv.id, userId: userIdB },
    ]);

    return { id: conv.id, created: true as const };
  });

  // The initiator (userIdA — passed as the first arg from the route handler
  // where it comes from the authed user) gets points for starting a chat.
  // Fire-and-forget; failures are logged inside recordActivity.
  void recordActivity(userIdA, 'chat_started', { conversationId: result.id });

  return result;
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

/**
 * In-memory cache of the Superchat conversation id. Set on first lookup —
 * the row never changes id once seeded, so a single query is enough per
 * process lifetime.
 */
let _superchatIdCache: string | null = null;
export async function getSuperchatId(): Promise<string | null> {
  if (_superchatIdCache) return _superchatIdCache;
  const room = await getSuperchat();
  if (room) _superchatIdCache = room.id;
  return _superchatIdCache;
}

/** Count of users joined to the Superchat room. */
export async function countSuperchatParticipants(): Promise<number> {
  const id = await getSuperchatId();
  if (!id) return 0;
  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM conversation_participants
    WHERE conversation_id = ${id}
  `);
  return (result.rows[0]?.n as number) ?? 0;
}

/**
 * Lightweight slice of participants for the header avatar stack —
 * `limit` newest joiners. Ordered the same as the full list so the
 * preview and the modal stay visually consistent.
 */
export async function listSuperchatParticipantPreviews(limit = 5) {
  const id = await getSuperchatId();
  if (!id) return [];
  const result = await db.execute(sql`
    SELECT
      u.id         AS id,
      u.name       AS name,
      u.avatar_url AS avatar_url
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.conversation_id = ${id}
    ORDER BY cp.joined_at DESC
    LIMIT ${limit}
  `);
  return result.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string | null,
    avatarUrl: r.avatar_url as string | null,
  }));
}

/** Public profile rows of every user in the Superchat, newest joiner first. */
export async function listSuperchatParticipants() {
  const id = await getSuperchatId();
  if (!id) return [];
  const result = await db.execute(sql`
    SELECT
      u.id           AS id,
      u.name         AS name,
      u.email        AS email,
      u.avatar_url   AS avatar_url,
      u.city         AS city,
      cp.joined_at   AS joined_at,
      u.last_seen_at AS last_seen_at
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.conversation_id = ${id}
    ORDER BY cp.joined_at DESC
  `);
  return result.rows.map((r) => ({
    id: r.id as string,
    name: r.name as string | null,
    email: r.email as string,
    avatarUrl: r.avatar_url as string | null,
    city: r.city as string | null,
    joinedAt: (r.joined_at as Date).toISOString(),
    lastSeenAt: r.last_seen_at ? (r.last_seen_at as Date).toISOString() : null,
  }));
}
