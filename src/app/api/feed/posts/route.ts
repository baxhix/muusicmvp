import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import {
  listPublicFeedPosts,
  publishDueScheduled,
  type FeedType,
} from '@/server/feed/admin';

export const runtime = 'nodejs';

/**
 * GET /api/feed/posts — public feed listing.
 *   query: limit?, offset?
 *
 * Returns admin-CMS posts where status='published' AND is_active=true
 * AND publishedAt<=now, newest-first. The auth gate matches every
 * other /api/* route the player UI hits (the feed is for signed-in
 * users only).
 *
 * Side-effect: each call sweeps due `scheduled` posts → `published`
 * so the feed never lags behind the schedule by more than one read.
 */
const FEED_TYPES = ['image', 'video', 'carousel', 'story', 'poll', 'sponsored', 'broadcast', 'audio'] as const;
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  /** Filter to a single post type. Used by /app to fetch ONLY
   *  stories for the Stories rail while leaving image/video/etc.
   *  for the main feed query. */
  type: z.enum(FEED_TYPES).optional(),
});

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  // Best-effort lazy promote — non-blocking on failure.
  publishDueScheduled().catch((err) =>
    console.warn('publishDueScheduled (public feed) failed:', err),
  );

  const items = await listPublicFeedPosts({
    limit: parsed.data.limit,
    offset: parsed.data.offset,
    type: parsed.data.type as FeedType | undefined,
  });
  return NextResponse.json({ items });
}
