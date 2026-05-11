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

    return { msg, others, conv };
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
  };
}
