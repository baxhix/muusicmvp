import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/requireUser';
import { searchUsers } from '@/server/users/queries';

export const runtime = 'nodejs';

const querySchema = z.object({
  q: z.string().min(2).max(64),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(req: Request) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    limit: url.searchParams.get('limit') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const results = await searchUsers(parsed.data.q, user.id, parsed.data.limit);
  return NextResponse.json({ users: results });
}
