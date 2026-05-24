import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import {
  adminDeleteCommunity,
  adminUpdateCommunity,
  getAdminCommunity,
} from '@/server/communities/admin';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 *   GET    /api/admin/communities/:slug   → detail with counters
 *   PATCH  /api/admin/communities/:slug   → name / description / image / creator
 *   DELETE /api/admin/communities/:slug   → cascades through everything
 */

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).nullish(),
  imageUrl: z.string().max(500).nullish(),
  creatorId: z.string().uuid().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await ctx.params;
  const community = await getAdminCommunity(slug);
  if (!community) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ community });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin();
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
    await adminUpdateCommunity({
      slug,
      name: parsed.data.name,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl,
      creatorId: parsed.data.creatorId,
    });
    const community = await getAdminCommunity(slug);
    return NextResponse.json({ community });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'update_failed';
    const status =
      code === 'not_found' ||
      code === 'creator_not_found' ||
      code === 'creator_not_a_member'
        ? code === 'not_found'
          ? 404
          : 400
        : code === 'name_empty' || code === 'name_too_long'
          ? 400
          : 500;
    if (status === 500)
      logger.error('admin.communities.slug.patch-apiadmincommunitiesslug', err)
    return NextResponse.json({ error: code }, { status });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await ctx.params;
  try {
    await adminDeleteCommunity(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'delete_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500)
      logger.error('admin.communities.slug.delete-apiadmincommunitiesslug', err)
    return NextResponse.json({ error: code }, { status });
  }
}
