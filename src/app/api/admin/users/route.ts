import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { listAllUsers } from '@/server/admin/queries';

export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Returns the registered users in the shape the admin "Usuários" table
 * consumes directly. The total count rides along in a header so the
 * response body itself is a plain array — keeps the existing
 * usersService.list() consumer unchanged on the admin side.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const { users, total } = await listAllUsers(parsed.data);
  return NextResponse.json(users, {
    headers: { 'X-Total-Count': String(total) },
  });
}
