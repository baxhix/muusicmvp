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
 *
 * Wraps getRanking in a try/catch so a missing migration (user_activities
 * table absent) returns a labeled 500 the client can surface instead of
 * an empty list.
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

  try {
    const ranking = await getRanking(parsed.data.limit);
    console.log(`[ranking] returned ${ranking.length} users to ${auth.email}`);
    return NextResponse.json({ ranking });
  } catch (err) {
    // The most likely cause when this throws is a missing user_activities
    // table — i.e. migration 0003 not yet applied on this environment.
    const msg = err instanceof Error ? err.message : String(err);
    const tableMissing =
      /user_activities/i.test(msg) &&
      /(does not exist|undefined table|42P01)/i.test(msg);
    console.error('[ranking] query failed:', msg);
    return NextResponse.json(
      {
        error: tableMissing ? 'migration_missing' : 'query_failed',
        detail: msg,
      },
      { status: 500 },
    );
  }
}
