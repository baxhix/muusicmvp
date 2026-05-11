import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { getListeningHistory } from '@/server/history/queries';

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

  const { items, hasMore } = await getListeningHistory(user.id, {
    limit: parsed.data.limit,
    before: parsed.data.before ? new Date(parsed.data.before) : undefined,
  });

  return NextResponse.json({ items, hasMore });
}
