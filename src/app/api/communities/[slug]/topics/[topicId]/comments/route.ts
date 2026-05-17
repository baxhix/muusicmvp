import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getCurrentUser } from '@/server/auth/session';
import {
  createTopicComment,
  listTopicComments,
} from '@/server/communities/queries';

export const runtime = 'nodejs';

/**
 *   GET  /api/communities/:slug/topics/:topicId/comments
 *     → flat list of comments (oldest first). Reads are public so
 *       the forum thread is browsable without joining.
 *
 *   POST /api/communities/:slug/topics/:topicId/comments
 *     body: { body, parentCommentId? }
 *     → author must be a member of the community. Reply by passing
 *       `parentCommentId`.
 */

const postSchema = z.object({
  body: z.string().min(1).max(2000),
  parentCommentId: z.string().uuid().nullish(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; topicId: string }> },
) {
  await getCurrentUser();
  const { topicId } = await ctx.params;
  try {
    const page = await listTopicComments({ topicId });
    return NextResponse.json(page);
  } catch (err) {
    console.error('GET topic comments failed:', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; topicId: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { topicId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const res = await createTopicComment({
      topicId,
      authorId: auth.id,
      body: parsed.data.body,
      parentCommentId: parsed.data.parentCommentId ?? null,
    });
    return NextResponse.json(res, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'create_failed';
    const status =
      code === 'not_found' || code === 'topic_deleted'
        ? 404
        : code === 'not_a_member'
          ? 403
          : code === 'empty_body' || code === 'body_too_long'
            ? 400
            : 500;
    if (status === 500) console.error('POST topic comment failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
