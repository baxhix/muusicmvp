import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { deleteComment } from '@/server/feed/comments';
import { ForbiddenError, handleApiError } from '@/server/api/errors';

export const runtime = 'nodejs';

/**
 * DELETE /api/feed/comments/:id — soft-delete a comment.
 *
 * Authorization is enforced inside deleteComment():
 *   - author of the comment, OR
 *   - user.role === 'admin' (moderation).
 * Anyone else gets 403. Already-deleted rows are treated as success
 * for idempotency.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const { id } = await params;

  try {
    const ok = await deleteComment({
      commentId: id,
      callerId: user.id,
      callerIsAdmin: user.role === 'admin',
    });
    if (!ok) throw new ForbiddenError('forbidden_or_missing');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, {
      scope: 'feed.comments.delete',
      ctx: { id, userId: user.id },
    });
  }
}
