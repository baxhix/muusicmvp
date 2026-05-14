import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import {
  deleteGroup,
  getUserRole,
  updateGroup,
} from '@/server/chat/groups';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  imageUrl: z.string().max(500).nullable().optional(),
});

/**
 * PATCH /api/conversations/:id
 * Rename a group or update its avatar. Owner OR admin only.
 */
export async function PATCH(
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const role = await getUserRole(id, user.id);
  if (!role) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (role === 'member') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    await updateGroup(id, parsed.data);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'patch_failed';
    return NextResponse.json({ error: code }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/conversations/:id
 * Hard-delete a group + cascade its messages/reactions/etc. Owner only.
 * DMs cannot be deleted via this route (they're permanent records).
 */
export async function DELETE(
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

  const role = await getUserRole(id, user.id);
  if (role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await deleteGroup(id);
  return NextResponse.json({ ok: true });
}
