import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { likeTrack, unlikeTrack } from '@/server/history/queries';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/** Like a track (idempotent — already liked just returns 200). */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ trackId: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { trackId } = await ctx.params;
  if (!uuid.safeParse(trackId).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  await likeTrack(user.id, trackId);
  return NextResponse.json({ liked: true });
}

/** Unlike a track. 200 even if it wasn't liked (idempotent). */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ trackId: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { trackId } = await ctx.params;
  if (!uuid.safeParse(trackId).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  await unlikeTrack(user.id, trackId);
  return NextResponse.json({ liked: false });
}
