import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { listMembers } from '@/server/communities/queries';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/communities/:slug/members
 *   → list of members. Public — drives the "Ver todos" modal under
 *     the avatar stack on the community detail header. Auth is
 *     touched so the access log is still associated with a session.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  await getCurrentUser();
  const { slug } = await ctx.params;

  try {
    const page = await listMembers({ slug });
    return NextResponse.json(page);
  } catch (err) {
    const code = err instanceof Error ? err.message : 'list_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500)
      logger.error('communities.slug.members.get-apicommunitiesslugmembers', err)
    return NextResponse.json({ error: code }, { status });
  }
}
