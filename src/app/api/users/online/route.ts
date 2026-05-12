import { NextResponse } from 'next/server';
import { count } from 'drizzle-orm';
import { db } from '@/server/db';
import { users as usersTable } from '@/server/db/schema';
import { requireUser } from '@/server/auth/requireUser';
import { listOnlineUsers } from '@/server/users/queries';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  // Parallel: online list + total registered head-count. The total
  // drives the ambient "fan presence" dots scattered on the map —
  // having it on this endpoint avoids a second roundtrip on first
  // paint.
  const [users, totalRow] = await Promise.all([
    listOnlineUsers(user.id),
    db.select({ value: count() }).from(usersTable),
  ]);

  return NextResponse.json({
    users,
    totalRegistered: totalRow[0]?.value ?? 0,
  });
}
