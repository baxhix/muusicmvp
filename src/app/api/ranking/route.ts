import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getRanking } from '@/server/activities/queries';

export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * Global leaderboard. Returned to any authenticated user — the modal in
 * the TopBar is visible to everyone, and the scores aren't sensitive.
 */
export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const ranking = await getRanking(parsed.data.limit);
  return NextResponse.json({ ranking });
}
