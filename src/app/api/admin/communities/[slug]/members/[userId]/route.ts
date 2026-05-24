import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { adminRemoveMember } from '@/server/communities/admin';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * DELETE /api/admin/communities/:slug/members/:userId
 *   Force-removes a user from the community. Admin override —
 *   even the creator can be kicked. Use the PATCH on the parent
 *   community route to reassign creatorId before kicking the
 *   original owner if you want a clean handover.
 */

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string; userId: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { slug, userId } = await ctx.params;
  try {
    const res = await adminRemoveMember({ slug, userId });
    return NextResponse.json(res);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'remove_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500) logger.error('admin.communities.slug.members.userId.admin-remove-member', err)
    return NextResponse.json({ error: code }, { status });
  }
}
