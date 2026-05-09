import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { listNotifications } from '@/server/listening/queries';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const items = await listNotifications(user.id, 50);
  return NextResponse.json({ notifications: items });
}
