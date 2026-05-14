import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { userIsInConversation } from '@/server/chat/queries';
import {
  addMember,
  getUserRole,
  listMembers,
} from '@/server/chat/groups';
import { userExists } from '@/server/chat/dm';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/**
 * GET /api/conversations/:id/members
 * Roster of the conversation — name + avatar + role for each
 * participant. Visible to anyone IN the conversation.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  if (!(await userIsInConversation(user.id, id))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const members = await listMembers(id);
  return NextResponse.json({ members });
}

const addSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * POST /api/conversations/:id/members
 * Add a user to a group as 'member'. Owner OR admin only.
 * Idempotent: re-adding an existing member is a no-op.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const role = await getUserRole(id, user.id);
  if (!role || role === 'member') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!(await userExists(parsed.data.userId))) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  await addMember(id, parsed.data.userId);
  return NextResponse.json({ ok: true });
}
