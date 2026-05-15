import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  deleteFeedPost,
  getAdminFeedPost,
  updateFeedPost,
} from '@/server/feed/admin';

export const runtime = 'nodejs';

const FEED_TYPES = ['image', 'video', 'carousel', 'story', 'poll', 'sponsored', 'broadcast'] as const;

/** Mirror of the createSchema's media descriptor. Kept inline (vs
 *  imported) because the two routes are deliberately independent
 *  — easier to evolve one without breaking the other. */
const mediaItemSchema = z.object({
  url:    z.string().min(1).max(500),
  alt:    z.string().max(300).nullish(),
  kind:   z.enum(['image', 'video']).optional(),
  poster: z.string().min(1).max(500).nullish(),
});

const patchSchema = z.object({
  type: z.enum(FEED_TYPES).optional(),
  title: z.string().max(200).nullish(),
  description: z.string().max(2200).nullish(),
  media: z.array(mediaItemSchema).max(20).optional(),
  scheduledAt: z.string().datetime().nullish(),
  /** ISO timestamp. Same semantics as the create route. */
  expiresAt: z.string().datetime().nullish(),
  isActive: z.boolean().optional(),
  action: z.enum(['publish', 'schedule', 'draft']).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const post = await getAdminFeedPost(id);
  if (!post) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(post);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const post = await updateFeedPost(id, {
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      media: parsed.data.media,
      scheduledAt: parsed.data.scheduledAt ?? undefined,
      expiresAt: parsed.data.expiresAt ?? undefined,
      isActive: parsed.data.isActive,
      action: parsed.data.action,
    });
    return NextResponse.json(post);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'update_failed';
    const status =
      code === 'post_not_found'
        ? 404
        : code === 'invalid_schedule_date' ||
            code === 'schedule_requires_date' ||
            code === 'schedule_in_past' ||
            code === 'description_too_long' ||
            code === 'title_too_long' ||
            code === 'image_required' ||
            code === 'video_required' ||
            code === 'story_media_required' ||
            code === 'invalid_expires_date'
          ? 400
          : 500;
    if (status === 500) console.error('updateFeedPost failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const ok = await deleteFeedPost(id);
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
