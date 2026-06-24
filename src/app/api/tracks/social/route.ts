import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getTracksSocialBatch } from '@/server/tracks/social';

export const runtime = 'nodejs';

/**
 * Social em LOTE de várias faixas (por youtubeId) — usado pela
 * PlaylistModal pra pintar os contadores de like/comentário de cada
 * row de uma vez.
 *   POST /api/tracks/social  body { youtubeIds: string[] }
 *     → { social: { [ytId]: { likeCount, likedByMe, commentCount } } }
 */
const schema = z.object({
  youtubeIds: z.array(z.string().min(1).max(64)).max(200),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const social = await getTracksSocialBatch(parsed.data.youtubeIds, user.id);
  return NextResponse.json({ social });
}
