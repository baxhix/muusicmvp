import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getCurrentUser } from '@/server/auth/session';
import {
  deleteCommunity,
  getCommunityBySlug,
  updateCommunity,
} from '@/server/communities/queries';

export const runtime = 'nodejs';

/**
 *   GET    /api/communities/:slug   → community detail
 *   PATCH  /api/communities/:slug   → creator only (rename / re-image)
 *   DELETE /api/communities/:slug   → creator only
 */

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullish(),
  imageUrl: z.string().max(500).nullish(),
});

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

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await ctx.params;
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
    await updateCommunity({
      slug,
      viewerId: auth.id,
      name: parsed.data.name,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
    });
    const community = await getCommunityBySlug(slug, auth.id);
    return NextResponse.json({ community });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'update_failed';
    const status =
      code === 'forbidden'
        ? 403
        : code === 'not_found'
          ? 404
          : code === 'name_empty' || code === 'name_too_long'
            ? 400
            : 500;
    if (status === 500)
      console.error('PATCH /api/communities/:slug failed:', err);
    return NextResponse.json({ error: code }, { status });
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
