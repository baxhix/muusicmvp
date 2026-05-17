import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { isMember, listMembers } from '@/server/communities/queries';

export const runtime = 'nodejs';

/**
 * GET /api/communities/:slug/members
 *   → list of members. Member-only access — non-members get 403
 *     so the participants list stays a "perk" of joining.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const { slug } = await ctx.params;

  try {
    const allowed = await isMember(slug, auth.id);
    if (!allowed) {
      return NextResponse.json({ error: 'not_a_member' }, { status: 403 });
    }
    const page = await listMembers({ slug });
    return NextResponse.json(page);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'list_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500)
      console.error('GET /api/communities/:slug/members failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
