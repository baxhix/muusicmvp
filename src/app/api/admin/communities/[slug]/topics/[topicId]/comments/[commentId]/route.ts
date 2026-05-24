import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  adminHardDeleteComment,
  adminSoftDeleteComment,
} from '@/server/communities/admin';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 *   PATCH  /api/admin/communities/:slug/topics/:topicId/comments/:commentId
 *     body: { deletedAt: null | true } — restore / soft-delete.
 *   DELETE /api/admin/communities/:slug/topics/:topicId/comments/:commentId?hard=true
 *     Hard-delete by default. ?hard=false → soft-delete.
 */

const patchSchema = z.object({
  deletedAt: z.union([z.null(), z.literal(true)]),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { commentId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    await adminSoftDeleteComment({
      commentId,
      restore: parsed.data.deletedAt === null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'update_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500) logger.error('admin.communities.slug.topics.topicId.comments.commentId.admin-patch-comment', err)
    return NextResponse.json({ error: code }, { status });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ commentId: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { commentId } = await ctx.params;
  const url = new URL(req.url);
  const hardFlag = (url.searchParams.get('hard') ?? 'true').toLowerCase();
  const hard = hardFlag !== 'false' && hardFlag !== '0';

  try {
    if (hard) await adminHardDeleteComment(commentId);
    else await adminSoftDeleteComment({ commentId, restore: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'delete_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500) logger.error('admin.communities.slug.topics.topicId.comments.commentId.admin-delete-comment', err)
    return NextResponse.json({ error: code }, { status });
  }
}
