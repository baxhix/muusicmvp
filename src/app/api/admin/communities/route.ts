import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listAdminCommunities } from '@/server/communities/admin';

export const runtime = 'nodejs';

/**
 * GET /api/admin/communities
 *   query: search?, limit?, offset?
 *   Returns the admin-grade list with denormalized counters +
 *   creator info join. The X-Total-Count header carries the total
 *   for the table footer.
 */

const querySchema = z.object({
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    search: url.searchParams.get('search') ?? undefined,
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const { items, total } = await listAdminCommunities({
    search: parsed.data.search,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });

  return NextResponse.json(
    { items, total },
    { headers: { 'X-Total-Count': String(total) } },
  );
}
