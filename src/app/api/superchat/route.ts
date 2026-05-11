import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import {
  countSuperchatParticipants,
  ensureSuperchatMembership,
  getSuperchat,
} from '@/server/chat/dm';
import { listMessages } from '@/server/chat/queries';

export const runtime = 'nodejs';

/**
 * Convenience endpoint: returns the global Superchat conversation row plus
 * recent messages, the participant count, and ensures the caller is
 * joined as a participant.
 */
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  const room = await getSuperchat();
  if (!room) {
    return NextResponse.json({ error: 'superchat_not_seeded' }, { status: 503 });
  }

  await ensureSuperchatMembership(user.id);
  const [{ messages, hasMore }, participantCount] = await Promise.all([
    listMessages(room.id, { limit: 50 }),
    countSuperchatParticipants(),
  ]);

  return NextResponse.json({
    conversation: { id: room.id, type: room.type, name: room.name, slug: room.slug },
    messages,
    hasMore,
    participantCount,
  });
}
