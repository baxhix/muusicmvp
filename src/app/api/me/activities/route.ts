import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getUserActivities, getUserPoints } from '@/server/activities/queries';

export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: z.string().datetime().optional(),
});

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    before: url.searchParams.get('before') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const [{ items, hasMore }, total] = await Promise.all([
    getUserActivities(user.id, {
      limit: parsed.data.limit,
      before: parsed.data.before ? new Date(parsed.data.before) : undefined,
    }),
    getUserPoints(user.id),
  ]);

  return NextResponse.json({ items, hasMore, totalPoints: total });
}
