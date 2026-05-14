import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import {
  createComment,
  getOrCreateFeedPost,
  listComments,
} from '@/server/feed/comments';

export const runtime = 'nodejs';

/**
 * Comments for one feed post, addressed by a stable `postKey` slug
 * (the client derives it from the post's first media src — see
 * FeedPanel mock data). The server lazy-creates the underlying
 * `feed_posts` row the first time the post is touched, so the mock
 * feed and the comments table stay in sync without a seed step.
 *
 *   GET  /api/feed/posts/:postKey/comments?before=ISO&limit=20
 *     → paginated top-level comments, newest first.
 *
 *   POST /api/feed/posts/:postKey/comments
 *     body: { body: string }
 *     → creates a top-level comment. Returns { id } so the client
 *       can render it optimistically.
 */
const querySchema = z.object({
  before: z.string().datetime().nullish(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const postSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postKey: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { postKey } = await params;
  const decodedKey = decodeURIComponent(postKey);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    before: url.searchParams.get('before'),
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const { id: postId } = await getOrCreateFeedPost(decodedKey);
    const page = await listComments({
      postId,
      viewerId: user.id,
      before: parsed.data.before ? new Date(parsed.data.before) : null,
      limit: parsed.data.limit,
    });
    return NextResponse.json({ postId, ...page });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'list_failed';
    const status =
      code === 'invalid_post_key' || code === 'post_key_too_long'
        ? 400
        : code === 'feed_post_not_found'
          ? 404
          : 500;
    if (status === 500) console.error('GET comments failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ postKey: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { postKey } = await params;
  const decodedKey = decodeURIComponent(postKey);

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

  try {
    const { id: postId } = await getOrCreateFeedPost(decodedKey);
    const { id } = await createComment({
      postId,
      authorId: user.id,
      body: parsed.data.body,
    });
    return NextResponse.json({ id, postId }, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'create_failed';
    const status =
      code === 'empty_body' || code === 'body_too_long' || code === 'invalid_post_key'
        ? 400
        : 500;
    if (status === 500) console.error('POST comment failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
