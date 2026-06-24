import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { deleteTrackComment } from '@/server/tracks/social';

export const runtime = 'nodejs';

const uuid = z.string().uuid();

/** Apaga (soft) o próprio comentário de uma faixa. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ ytId: string; commentId: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { commentId } = await params;
  if (!uuid.safeParse(commentId).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const ok = await deleteTrackComment(commentId, user.id);
  if (!ok) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
