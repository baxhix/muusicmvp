import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { toggleTopicCommentReaction } from '@/server/communities/queries';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 *   POST /api/communities/:slug/topics/:topicId/comments/:commentId/reactions
 *     body: { emoji? }
 *     → toggles ❤️ (default) on the comment. Member-only is NOT
 *       enforced — the public feed pattern is the same: any
 *       authenticated user can react. Body is optional so a plain
 *       POST without payload acts as a "❤️ toggle".
 */

const postSchema = z.object({
  emoji: z.string().min(1).max(32).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { commentId } = await ctx.params;

  // Body is optional — empty POST = ❤️ toggle.
  let parsedEmoji: string | undefined;
  try {
    const raw = await req.text();
    if (raw.trim()) {
      const parsed = postSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }
      parsedEmoji = parsed.data.emoji;
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const res = await toggleTopicCommentReaction({
      commentId,
      userId: auth.id,
      emoji: parsedEmoji,
    });
    return NextResponse.json(res);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'toggle_failed';
    const status =
      code === 'comment_not_found'
        ? 404
        : code === 'comment_deleted'
          ? 410
          : code === 'invalid_emoji' || code === 'emoji_too_long'
            ? 400
            : 500;
    if (status === 500)
      logger.error('communities.slug.topics.topicId.comments.commentId.reactions.post-topic-comment-reaction', err)
    return NextResponse.json({ error: code }, { status });
  }
}
