import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { getSuperfansForAdmin } from '@/server/admin/queries';

export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * Top users by points, in the exact shape the admin Superfãs table
 * expects — no client-side mapping needed. Defaults to top 100.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const rows = await getSuperfansForAdmin(parsed.data.limit ?? 100);
  return NextResponse.json(rows);
}
