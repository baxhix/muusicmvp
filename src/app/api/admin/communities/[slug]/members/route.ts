import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listAdminMembers } from '@/server/communities/admin';

export const runtime = 'nodejs';

/**
 * GET /api/admin/communities/:slug/members
 *   query: search?, limit?, offset?
 *   Lists members with admin-grade detail. The kick action lives
 *   on the per-user route /members/:userId.
 */

const querySchema = z.object({
  search: z.string().max(200).optional(),
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
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  try {
    const { items, total } = await listAdminMembers({
      slug,
      search: parsed.data.search,
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
    if (status === 500)
      console.error('admin members list failed:', err);
    return NextResponse.json({ error: code }, { status });
  }
}
