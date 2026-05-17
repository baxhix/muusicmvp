import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getOrCreateFeedPost } from '@/server/feed/comments';
import { recordActivity } from '@/server/activities/queries';

export const runtime = 'nodejs';

/**
 * Engagement reward endpoint for the chapéu / heart on a feed
 * post. Fire-and-forget from the client — there's no toggle
 * persistence here (likes-on-posts don't have a dedicated table
 * yet); the endpoint just appends a `post_liked` row to
 * `user_activities` for the Fanpoints ledger.
 *
 *   POST /api/feed/posts/:postKey/like
 *     → returns { ok: true }. The +5 FP reward is recorded
 *       server-side via recordActivity.
 *
 * Mirrors the postKey → feedPosts.id resolution the comments
 * endpoint uses (getOrCreateFeedPost), so mock-feed posts and
 * admin-CMS posts both work without an extra seed step.
 *
 * Calling this twice rapidly (double-tap) records two activity
 * rows — that's a known limitation for now since we don't have
 * a per-user × per-post unique constraint. Acceptable until a
 * proper `post_reactions` table lands; the analytics layer can
 * dedupe at query time if needed.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ postKey: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { postKey } = await ctx.params;
  const decodedKey = decodeURIComponent(postKey);
  const { id: postId } = await getOrCreateFeedPost(decodedKey);

  // Fire-and-forget — failures inside recordActivity are logged
  // but don't propagate so a transient FP ledger error never
  // blocks the like UX.
  void recordActivity(user.id, 'post_liked', { postId });

  return NextResponse.json({ ok: true });
}
