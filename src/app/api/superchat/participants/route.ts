import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import { listSuperchatParticipants } from '@/server/chat/dm';

export const runtime = 'nodejs';

/**
 * Returns the list of users joined to the Superchat — name, avatar, city,
 * joined-at, last-seen-at. Used by the "X participantes" popover.
 */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const participants = await listSuperchatParticipants();
  return NextResponse.json({ participants });
}
