import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import {
  findTrackByYoutubeId,
  notifySameTrackListeners,
  recordListeningTick,
  stopListening,
} from '@/server/listening/queries';

export const runtime = 'nodejs';

/**
 * Idempotent listening event. Two shapes:
 *   1. Active tick:   { youtubeId, positionSeconds, isPaused }
 *   2. Stop/cleanup:  { kind: 'stop' }
 *
 * Same-track notifications fire only when the track changes (or starts), not
 * on every periodic tick — keeps the noise reasonable.
 */
const tickSchema = z.object({
  youtubeId: z.string().min(1),
  positionSeconds: z.number().min(0).max(60 * 60 * 6), // 6h cap
  isPaused: z.boolean().default(false),
});
const stopSchema = z.object({ kind: z.literal('stop') });
const bodySchema = z.union([stopSchema, tickSchema]);

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  let body;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if ('kind' in body && body.kind === 'stop') {
    await stopListening(user.id);
    return NextResponse.json({ ok: true });
  }

  const tick = body as z.infer<typeof tickSchema>;
  const track = await findTrackByYoutubeId(tick.youtubeId);
  if (!track) {
    return NextResponse.json({ error: 'track_not_in_catalog' }, { status: 404 });
  }

  const { trackChanged } = await recordListeningTick(
    user.id,
    track.id,
    tick.positionSeconds,
    tick.isPaused,
  );

  let notified: number = 0;
  if (trackChanged) {
    const created = await notifySameTrackListeners(user.id, track.id);
    notified = created.length;
  }

  return NextResponse.json({
    ok: true,
    trackId: track.id,
    trackChanged,
    sameTrackNotificationsCreated: notified,
  });
}
