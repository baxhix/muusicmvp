import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { deleteTrack } from '@/server/tracks/queries';

export const runtime = 'nodejs';

/**
 * Hard-delete a track. Cascades to listening_history via the FK
 * (tracks.id ← user_activities.track_id is ON DELETE SET NULL,
 * listening_history.track_id is ON DELETE CASCADE).
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const ok = await deleteTrack(id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
