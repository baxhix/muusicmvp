import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db';
import {
  conversationParticipants,
  conversations,
  messages,
  notifications,
  type Message,
} from '../db/schema';

export interface SendMessageResult {
  message: Message;
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

  return await db.transaction(async (tx) => {
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

    return {
      message: msg,
      recipientIds: others.map((p) => p.userId),
      conversationType: (conv?.type ?? 'dm') as 'dm' | 'group',
    };
  });
}
