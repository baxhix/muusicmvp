import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getOrCreateFeedPost } from '@/server/feed/comments';
import { recordActivity } from '@/server/activities/queries';

export const runtime = 'nodejs';

/**
 * Engagement reward endpoint for the "send / share" arrow on a
 * feed post. Same fire-and-forget shape as the like endpoint —
 * appends a `post_shared` row to `user_activities` (+15 FP) and
 * returns immediately. The actual share UX (sheet, target picker,
 * etc.) is handled client-side; the server's only job here is
 * crediting the Fanpoints.
 *
 *   POST /api/feed/posts/:postKey/share
 *     → returns { ok: true }
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
  void recordActivity(user.id, 'post_shared', { postId });

  return NextResponse.json({ ok: true });
}
