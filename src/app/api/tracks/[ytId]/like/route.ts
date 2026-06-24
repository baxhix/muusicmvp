import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getOrCreateTrackId, toggleTrackLike } from '@/server/tracks/social';

export const runtime = 'nodejs';

/**
 * Toggle do like de uma faixa, endereçada pelo `ytId` (youtubeId).
 * POST /api/tracks/:ytId/like → { liked, likeCount }
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ ytId: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { ytId } = await params;
  const youtubeId = decodeURIComponent(ytId);
  const trackId = await getOrCreateTrackId(youtubeId);
  if (!trackId) {
    return NextResponse.json({ error: 'unknown_track' }, { status: 404 });
  }

  const result = await toggleTrackLike(trackId, user.id);
  return NextResponse.json(result);
}
