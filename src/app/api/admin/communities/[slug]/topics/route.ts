import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listAdminTopics } from '@/server/communities/admin';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/**
 * GET /api/admin/communities/:slug/topics
 *   query: search?, includeDeleted?, limit?, offset?
 *   Lists topics in a community, optionally including soft-deleted
 *   ones (so the admin can restore). Default is "live" only.
 */

const querySchema = z.object({
  search: z.string().max(200).optional(),
  includeDeleted: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    search: url.searchParams.get('search') ?? undefined,
    includeDeleted: url.searchParams.get('includeDeleted') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const includeDeleted =
    parsed.data.includeDeleted === true ||
    parsed.data.includeDeleted === 'true' ||
    parsed.data.includeDeleted === '1';

  try {
    const { items, total } = await listAdminTopics({
      slug,
      search: parsed.data.search,
      includeDeleted,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
    return NextResponse.json(
      { items, total },
      { headers: { 'X-Total-Count': String(total) } },
    );
  } catch (err) {
    const code = err instanceof Error ? err.message : 'list_failed';
    const status = code === 'not_found' ? 404 : 500;
    if (status === 500) logger.error('admin.communities.slug.topics.admin-topics-list', err)
    return NextResponse.json({ error: code }, { status });
  }
}
