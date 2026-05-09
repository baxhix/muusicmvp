import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { listOnlineUsers } from '@/server/users/queries';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const users = await listOnlineUsers(user.id);
  return NextResponse.json({ users });
}
