import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { db } from '@/server/db';
import { feedComments } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { createComment, listReplies } from '@/server/feed/comments';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * Replies under a single parent comment.
 *
 *   GET  /api/feed/comments/:id/replies?limit=50
 *     → flat list of replies, oldest first (natural read order).
 *
 *   POST /api/feed/comments/:id/replies
 *     body: { body: string }
 *     → inserts a reply pinned to this parent. The post is inferred
 *       from the parent row so the client doesn't need to repeat it.
 */
const postSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await params;
  const url = new URL(req.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.max(1, Math.min(200, Number(limitParam) || 50)) : 50;

  try {
    const items = await listReplies({
      parentCommentId: id,
      viewerId: user.id,
      limit,
    });
    return NextResponse.json({ items });
  } catch (err) {
    logger.error('feed.comments.id.replies.get-replies', err)
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id: parentId } = await params;

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

  // Look up the parent's postId so we can pin the reply to the same
  // post — saves the client from carrying the postId in the URL.
  const [parent] = await db
    .select({ postId: feedComments.postId })
    .from(feedComments)
    .where(eq(feedComments.id, parentId))
    .limit(1);
  if (!parent) {
    return NextResponse.json({ error: 'parent_not_found' }, { status: 404 });
  }

  try {
    const { id } = await createComment({
      postId: parent.postId,
      authorId: user.id,
      body: parsed.data.body,
      parentCommentId: parentId,
    });
    return NextResponse.json({ id, postId: parent.postId }, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'create_failed';
    const status =
      code === 'empty_body' || code === 'body_too_long' || code === 'parent_post_mismatch'
        ? 400
        : code === 'parent_not_found'
          ? 404
          : 500;
    if (status === 500) logger.error('feed.comments.id.replies.post-reply', err)
    return NextResponse.json({ error: code }, { status });
  }
}
