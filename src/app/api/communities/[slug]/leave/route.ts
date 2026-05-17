import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { leaveCommunity } from '@/server/communities/queries';

export const runtime = 'nodejs';

/**
 * POST /api/communities/:slug/leave
 *   → idempotent. Creators cannot leave their own community (have
 *     to delete it instead) — returns 403 in that case.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;

  try {
    const res = await leaveCommunity({ slug, userId: auth.id });
    return NextResponse.json(res);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'leave_failed';
    const status =
      code === 'not_found'
        ? 404
        : code === 'creator_cannot_leave'
          ? 403
          : 500;
    if (status === 500)
      console.error('POST /api/communities/:slug/leave failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
