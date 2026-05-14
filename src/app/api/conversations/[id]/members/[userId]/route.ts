import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getUserRole, removeMember } from '@/server/chat/groups';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/**
 * DELETE /api/conversations/:id/members/:userId
 *
 * Used for two flows:
 *   - "Leave group": the caller removes themselves (userId === caller.id).
 *     Anyone with ANY role can do this. Owner leaving may orphan the
 *     group; future work: auto-promote oldest admin to owner.
 *   - "Kick member": owner/admin removes someone else. Cannot kick
 *     the owner; admins cannot kick other admins (only the owner can).
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id, userId } = await ctx.params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(userId).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const callerRole = await getUserRole(id, user.id);
  if (!callerRole) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Self-removal: always allowed for any participant.
  if (userId === user.id) {
    await removeMember(id, userId);
    return NextResponse.json({ ok: true });
  }

  // Kicking someone else: requires owner or admin role.
  if (callerRole === 'member') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const targetRole = await getUserRole(id, userId);
  if (!targetRole) {
    // Idempotent — they were already gone.
    return NextResponse.json({ ok: true });
  }
  if (targetRole === 'owner') {
    return NextResponse.json({ error: 'cannot_kick_owner' }, { status: 400 });
  }
  if (targetRole === 'admin' && callerRole !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await removeMember(id, userId);
  return NextResponse.json({ ok: true });
}
