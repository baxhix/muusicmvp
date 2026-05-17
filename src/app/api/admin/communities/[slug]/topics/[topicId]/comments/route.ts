import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listAdminTopicComments } from '@/server/communities/admin';

export const runtime = 'nodejs';

/**
 * GET /api/admin/communities/:slug/topics/:topicId/comments
 *   query: includeDeleted?, limit?, offset?
 *   Lists comments (and optionally soft-deleted ones) with reaction
 *   counts. The slug param is unused by the query — kept for URL
 *   symmetry with the public surface so the admin links resolve
 *   without rewriting paths.
 */

const querySchema = z.object({
  includeDeleted: z
    .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ topicId: string }> },
) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { topicId } = await ctx.params;
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
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

  const { items, total } = await listAdminTopicComments({
    topicId,
    includeDeleted,
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });
  return NextResponse.json(
    { items, total },
    { headers: { 'X-Total-Count': String(total) } },
  );
}
