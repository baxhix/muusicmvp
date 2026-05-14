import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import {
  conversationParticipants,
  conversations,
  messages,
  notifications,
  users,
  type Message,
} from '../db/schema';

/**
 * Message enriched with the sender's display name + avatar. Used by both
 * REST and Socket.IO emits so multi-user rooms (Superchat) can render the
 * sender's identity next to every bubble without per-message lookups.
 */
export interface HydratedMessage extends Message {
  senderName: string | null;
  senderEmail: string | null;
  senderAvatarUrl: string | null;
}

export interface SendMessageResult {
  message: HydratedMessage;
  /** Other participants of the conversation (excluding the sender). */
  recipientIds: string[];
  /** 'dm' | 'group' — caller decides whether to fan-out to user rooms. */
  conversationType: 'dm' | 'group';
  /** Subset of recipientIds that were @-mentioned in the body (group
   *  conversations only — always empty for DMs since mentions are
   *  redundant in 1:1 threads). Drives the realtime notify:new push
   *  in the socket handler. */
  mentionedUserIds: string[];
}

/**
 * Insert a message and create `message` notifications for every other
 * participant — but only for DMs. Group rooms (Superchat) skip notifications
 * to avoid the 1000x fan-out per message; the realtime channel covers them.
 *
 * Returns the message + the recipientIds so the caller (Socket.IO handler)
 * can emit per-user pokes to participants who aren't currently joined to
 * the conversation room.
 *
 * Caller must have already verified the sender is a participant.
 */
/** Pull every @[Display](uuid) token out of the body. Lifted to
 *  the server so the notification fan-out doesn't have to trust
 *  the client to pass the mentioned ids — we parse them ourselves
 *  from the canonical body format the client produced. */
const SERVER_MENTION_REGEX = /@\[[^\]]+\]\(([0-9a-f-]{36})\)/g;
function parseMentions(body: string): string[] {
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  // RegExp objects are stateful with /g; reset each call.
  const re = new RegExp(SERVER_MENTION_REGEX.source, 'g');
  while ((m = re.exec(body)) !== null) ids.push(m[1]);
  return Array.from(new Set(ids));
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<SendMessageResult> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('empty_message');
  if (trimmed.length > 4000) throw new Error('message_too_long');

  const txResult = await db.transaction(async (tx) => {
    const [msg] = await tx
      .insert(messages)
      .values({ conversationId, senderId, body: trimmed })
      .returning();

    const [conv] = await tx
      .select({ type: conversations.type })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    // Always fetch the other participants so the caller can broadcast to
    // their personal user rooms (covers users who haven't opened the
    // conversation room yet).
    const others = await tx
      .select({ userId: conversationParticipants.userId })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          ne(conversationParticipants.userId, senderId),
        ),
      );

    // Notifications only for DMs; groups rely on realtime + unread-count via
    // last_read_message_id.
    if (conv?.type === 'dm' && others.length) {
      await tx.insert(notifications).values(
        others.map((p) => ({
          userId: p.userId,
          kind: 'message' as const,
          sourceUserId: senderId,
          conversationId,
          messageId: msg.id,
        })),
      );
    }

    // Mention notifications — fire ONLY in groups (DMs are 1:1, so
    // a generic 'message' notification is already enough). Filter
    // mentioned ids against the actual participant set so an
    // injected/stale @[…] in the body can't notify random users.
    let validMentions: string[] = [];
    if (conv?.type === 'group') {
      const mentioned = parseMentions(trimmed);
      const validIds = new Set(others.map((o) => o.userId));
      validMentions = mentioned.filter(
        (id) => id !== senderId && validIds.has(id),
      );
      if (validMentions.length > 0) {
        await tx.insert(notifications).values(
          validMentions.map((userId) => ({
            userId,
            kind: 'mention' as const,
            sourceUserId: senderId,
            conversationId,
            messageId: msg.id,
          })),
        );
      }
    }

    return { msg, others, conv, validMentions };
  });

  // Hydrate the sender once for the realtime emit + REST response. Outside
  // the transaction so the row-level locks release as soon as the insert
  // commits.
  const [sender] = await db
    .select({
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, senderId))
    .limit(1);

  return {
    message: {
      ...txResult.msg,
      senderName: sender?.name ?? null,
      senderEmail: sender?.email ?? null,
      senderAvatarUrl: sender?.avatarUrl ?? null,
    },
    recipientIds: txResult.others.map((p) => p.userId),
    conversationType: (txResult.conv?.type ?? 'dm') as 'dm' | 'group',
    mentionedUserIds: txResult.validMentions,
  };
}
