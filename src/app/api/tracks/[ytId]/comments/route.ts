import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import {
  createTrackComment,
  getOrCreateTrackId,
  getTrackSocial,
  listTrackComments,
} from '@/server/tracks/social';

export const runtime = 'nodejs';

/**
 * Comentários + social de uma faixa, endereçada pelo `ytId` (youtubeId).
 * A row em `tracks` é resolvida/criada lazy a partir do catálogo.
 *
 *   GET  /api/tracks/:ytId/comments?before=ISO&limit=30
 *     → { trackId, comments, hasMore, social }
 *   POST /api/tracks/:ytId/comments  body { body }
 *     → { comment, social }
 */
const querySchema = z.object({
  before: z.string().datetime().nullish(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const postSchema = z.object({ body: z.string().min(1).max(2000) });

export async function GET(
  req: Request,
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

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    before: url.searchParams.get('before'),
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const [page, social] = await Promise.all([
    listTrackComments({
      trackId,
      viewerId: user.id,
      before: parsed.data.before ? new Date(parsed.data.before) : null,
      limit: parsed.data.limit,
    }),
    getTrackSocial(trackId, user.id),
  ]);

  return NextResponse.json({ trackId, ...page, social });
}

export async function POST(
  req: Request,
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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const comment = await createTrackComment({
    trackId,
    authorId: user.id,
    body: parsed.data.body,
  });
  const social = await getTrackSocial(trackId, user.id);
  return NextResponse.json({ comment, social }, { status: 201 });
}
