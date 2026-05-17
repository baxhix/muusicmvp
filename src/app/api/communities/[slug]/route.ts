import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { getCurrentUser } from '@/server/auth/session';
import {
  deleteCommunity,
  getCommunityBySlug,
} from '@/server/communities/queries';

export const runtime = 'nodejs';

/**
 *   GET    /api/communities/:slug   → community detail
 *   DELETE /api/communities/:slug   → creator only
 */

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const viewer = await getCurrentUser();

  try {
    const community = await getCommunityBySlug(slug, viewer?.id ?? null);
    if (!community) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ community });
  } catch (err) {
    console.error('GET /api/communities/:slug failed:', err);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await ctx.params;
  try {
    await deleteCommunity({ slug, viewerId: auth.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'delete_failed';
    const status =
      code === 'forbidden' ? 403 : code === 'not_found' ? 404 : 500;
    if (status === 500)
      console.error('DELETE /api/communities/:slug failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
