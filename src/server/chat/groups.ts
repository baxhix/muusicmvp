import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { conversationParticipants, conversations, users } from '../db/schema';

/**
 * Build a new user-created group conversation in a single transaction.
 *
 * Inserts the conversation row (type='group', name, image_url,
 * created_by=ownerId), then bulk-inserts conversation_participants
 * rows — the owner gets role='owner', everyone else 'member'.
 *
 * Returns the new conversation id. The caller is expected to have
 * pre-validated:
 *   - all `memberIds` correspond to real users
 *   - the caller themselves is included in the final member set
 *     (we add them defensively here even if not, just to be safe).
 */
export async function createGroup(args: {
  ownerId: string;
  name: string;
  imageUrl: string | null;
  memberIds: string[];
}): Promise<{ id: string }> {
  const trimmedName = args.name.trim();
  if (!trimmedName) {
    throw new Error('empty_name');
  }
  if (trimmedName.length > 80) {
    throw new Error('name_too_long');
  }

  // Always include the owner in the final participants set, even
  // if the caller forgot to. Dedupe + drop the owner's id from the
  // "other members" list since the owner gets a different role.
  const otherMemberIds = Array.from(
    new Set(args.memberIds.filter((id) => id !== args.ownerId)),
  );
  if (otherMemberIds.length === 0) {
    // A group needs at least the owner + one other member.
    throw new Error('not_enough_members');
  }

  // Verify all the proposed members exist. One query, then a
  // set-diff so we surface "user_not_found" precisely.
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, otherMemberIds));
  if (found.length !== otherMemberIds.length) {
    throw new Error('user_not_found');
  }

  return db.transaction(async (tx) => {
    const [conv] = await tx
      .insert(conversations)
      .values({
        type: 'group',
        name: trimmedName,
        imageUrl: args.imageUrl,
        createdBy: args.ownerId,
      })
      .returning({ id: conversations.id });

    await tx.insert(conversationParticipants).values([
      { conversationId: conv.id, userId: args.ownerId, role: 'owner' },
      ...otherMemberIds.map((userId) => ({
        conversationId: conv.id,
        userId,
        role: 'member' as const,
      })),
    ]);

    return { id: conv.id };
  });
}

/** Update name + image of a group. Owner/admin only — caller enforces. */
export async function updateGroup(
  conversationId: string,
  patch: { name?: string; imageUrl?: string | null },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (!trimmed) throw new Error('empty_name');
    if (trimmed.length > 80) throw new Error('name_too_long');
    update.name = trimmed;
  }
  if (patch.imageUrl !== undefined) update.imageUrl = patch.imageUrl;
  if (Object.keys(update).length === 0) return;

  await db
    .update(conversations)
    .set(update)
    .where(eq(conversations.id, conversationId));
}

/** Add a single user to a group as a 'member'. Idempotent via the
 *  composite PK on conversation_participants — re-adding a member
 *  is a no-op. */
export async function addMember(
  conversationId: string,
  userId: string,
): Promise<void> {
  await db
    .insert(conversationParticipants)
    .values({ conversationId, userId, role: 'member' })
    .onConflictDoNothing();
}

/** Remove a user from a group. Used for both "kick" (admin removing
 *  another user) and "leave" (user removing themselves). Idempotent. */
export async function removeMember(
  conversationId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    );
}

/** Hard-delete a group + cascade-delete its messages/reactions/etc.
 *  Owner only. Caller enforces. */
export async function deleteGroup(conversationId: string): Promise<void> {
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

/** Look up the caller's role inside a conversation. Returns null
 *  when the user isn't a participant. */
export async function getUserRole(
  conversationId: string,
  userId: string,
): Promise<'owner' | 'admin' | 'member' | null> {
  const rows = await db
    .select({ role: conversationParticipants.role })
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return (rows[0]?.role as 'owner' | 'admin' | 'member' | undefined) ?? null;
}

/** List the participants of a group — name + avatar + role for each.
 *  Used by the "Membros" panel + autocomplete for @mentions. */
export async function listMembers(conversationId: string) {
  const rows = await db.execute(sql`
    SELECT
      u.id, u.name, u.email, u.avatar_url, cp.role, cp.joined_at
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    WHERE cp.conversation_id = ${conversationId}
    ORDER BY
      CASE cp.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
      u.name NULLS LAST
  `);
  return rows.rows.map((r) => ({
    id: r.id as string,
    name: (r.name as string | null) ?? null,
    email: r.email as string,
    avatarUrl: (r.avatar_url as string | null) ?? null,
    role: r.role as 'owner' | 'admin' | 'member',
    joinedAt: r.joined_at as Date,
  }));
}
