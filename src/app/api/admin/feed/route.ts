import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  createFeedPost,
  listAdminFeedPosts,
  publishDueScheduled,
  type FeedStatus,
  type FeedType,
} from '@/server/feed/admin';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET  /api/admin/feed  → paginated admin listing.
 *   query: status?, type?, search?, limit?, offset?
 *   Side-effect: every read also runs the due-scheduled sweeper so
 *   posts whose `scheduledAt` has passed flip to `published` lazily,
 *   without needing a cron. Cheap (single indexed UPDATE) and means
 *   the admin never sees a stale "Agendado" status.
 *
 * POST /api/admin/feed  → create a post. Body fields are the same
 *   ones the PATCH endpoint accepts; see updateFeedPost for details.
 *   Returns the hydrated row so the listing can prepend it
 *   optimistically.
 */
const FEED_TYPES = ['image', 'video', 'carousel', 'story', 'poll', 'sponsored', 'broadcast', 'audio'] as const;
const FEED_STATUSES = ['published', 'scheduled', 'draft', 'inactive'] as const;

const listQuerySchema = z.object({
  status: z.enum([...FEED_STATUSES, 'all'] as [string, ...string[]]).optional(),
  type: z.enum([...FEED_TYPES, 'all'] as [string, ...string[]]).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** Single media descriptor accepted by the composer. The `kind`
 *  field distinguishes images from videos and `poster` is the
 *  video thumbnail (uploaded through the same /upload route as
 *  images). Kept loose at the type level — server-side
 *  validation in createFeedPost enforces "must have video item
 *  when type=video" etc. */
const mediaItemSchema = z.object({
  url:    z.string().min(1).max(500),
  alt:    z.string().max(300).nullish(),
  kind:   z.enum(['image', 'video']).optional(),
  poster: z.string().min(1).max(500).nullish(),
});

const createSchema = z.object({
  type: z.enum(FEED_TYPES).optional(),
  title: z.string().max(200).nullish(),
  description: z.string().max(2200).nullish(),
  media: z.array(mediaItemSchema).max(20).optional(),
  scheduledAt: z.string().datetime().nullish(),
  /** ISO timestamp. Stories auto-default to now+24h server-side
   *  when this is left undefined; pass null to override that and
   *  make the story never expire. */
  expiresAt: z.string().datetime().nullish(),
  isActive: z.boolean().optional(),
  action: z.enum(['publish', 'schedule', 'draft']).optional(),
});

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    status: url.searchParams.get('status') ?? undefined,
    type: url.searchParams.get('type') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  // Sweep due scheduled posts before reading. Best-effort — if it
  // fails, the listing still works (just with stale statuses).
  publishDueScheduled().catch((err) =>
    logger.warn('admin.feed.publish-due-scheduled'),
  );

  const { items, total } = await listAdminFeedPosts({
    status: parsed.data.status as FeedStatus | 'all' | undefined,
    type: parsed.data.type as FeedType | 'all' | undefined,
    search: parsed.data.search,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });

  return NextResponse.json(
    { items, total },
    { headers: { 'X-Total-Count': String(total) } },
  );
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;
  const admin = auth;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const post = await createFeedPost(admin.id, {
      type: parsed.data.type,
      title: parsed.data.title ?? null,
      description: parsed.data.description ?? null,
      media: parsed.data.media ?? [],
      scheduledAt: parsed.data.scheduledAt ?? null,
      expiresAt: parsed.data.expiresAt,
      isActive: parsed.data.isActive,
      action: parsed.data.action,
    });
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'create_failed';
    const status =
      code === 'image_required' ||
      code === 'video_required' ||
      code === 'story_media_required' ||
      code === 'description_too_long' ||
      code === 'title_too_long' ||
      code === 'invalid_schedule_date' ||
      code === 'schedule_requires_date' ||
      code === 'schedule_in_past' ||
      code === 'invalid_expires_date'
        ? 400
        : 500;
    if (status === 500) logger.error('admin.feed.createfeedpost', err)
    return NextResponse.json({ error: code }, { status });
  }
}
