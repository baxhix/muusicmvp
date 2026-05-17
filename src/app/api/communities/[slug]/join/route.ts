import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { joinCommunity } from '@/server/communities/queries';

export const runtime = 'nodejs';

/**
 * POST /api/communities/:slug/join
 *   → idempotent. Returns { joined: boolean } so the client knows
 *     whether to show "Joined!" or not.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;

  try {
    const res = await joinCommunity({ slug, userId: auth.id });
    return NextResponse.json(res);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'join_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500)
      console.error('POST /api/communities/:slug/join failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
