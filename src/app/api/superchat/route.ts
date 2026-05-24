import { NextResponse } from 'next/server';
import { requireUser } from '@/server/auth/requireUser';
import {
  countSuperchatParticipants,
  ensureSuperchatMembership,
  getSuperchat,
  listSuperchatParticipantPreviews,
} from '@/server/chat/dm';
import { listMessages } from '@/server/chat/queries';
import { listReactionsForMessages } from '@/server/chat/reactions';
import { logger } from '@/server/log';

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
  const [{ messages, hasMore }, participantCount, participantPreviews] =
    await Promise.all([
      listMessages(room.id, { limit: 50 }),
      countSuperchatParticipants(),
      listSuperchatParticipantPreviews(5),
    ]);

  // Hydrate reactions in a single batch query so every message arrives
  // ready to render — saves N round-trips on the client during initial
  // paint and keeps the panel from flickering chips in late.
  //
  // Graceful degradation: if the reactions table is missing or the
  // query fails for any reason, we serve messages without reactions
  // rather than 500'ing the whole endpoint. Without this guard, a
  // missed migration on deploy made the Superchat appear empty —
  // because the panel can't render messages it never received.
  let messagesWithReactions: typeof messages;
  try {
    const reactionsByMessage = await listReactionsForMessages(
      user.id,
      messages.map((m) => m.id),
    );
    messagesWithReactions = messages.map((m) => ({
      ...m,
      reactions: reactionsByMessage.get(m.id) ?? [],
    }));
  } catch (err) {
    logger.error('superchat.reactions-hydration', err);
    messagesWithReactions = messages.map((m) => ({ ...m, reactions: [] }));
  }

  return NextResponse.json({
    conversation: { id: room.id, type: room.type, name: room.name, slug: room.slug },
    messages: messagesWithReactions,
    hasMore,
    participantCount,
    participantPreviews,
  });
}
