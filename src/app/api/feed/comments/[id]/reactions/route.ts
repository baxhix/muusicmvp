import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { toggleCommentReaction } from '@/server/feed/comments';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * POST /api/feed/comments/:id/reactions
 *   body: { emoji?: string } — defaults to ❤️
 *
 * Idempotent toggle. Returns the new aggregated count + `mine` flag
 * so the optimistic UI can reconcile without a follow-up fetch.
 *
 * The picker UI today only fires ❤️ but the schema supports more
 * emojis — pass `{ emoji: '🔥' }` to add a different reaction.
 */
const schema = z.object({
  emoji: z.string().min(1).max(32).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await params;

  let payload: unknown = {};
  // body is optional — `await req.json()` will throw on empty body.
  try {
    if (req.headers.get('content-length') !== '0') {
      payload = await req.json();
    }
  } catch {
    payload = {};
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const result = await toggleCommentReaction({
      commentId: id,
      userId: user.id,
      emoji: parsed.data.emoji,
    });
    return NextResponse.json(result);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'toggle_failed';
    const status =
      code === 'comment_not_found'
        ? 404
        : code === 'comment_deleted' || code === 'invalid_emoji' || code === 'emoji_too_long'
          ? 400
          : 500;
    if (status === 500) logger.error('feed.comments.id.reactions.post-reaction', err)
    return NextResponse.json({ error: code }, { status });
  }
}
