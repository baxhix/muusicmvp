import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { notifications, users } from '../../db/schema';
import type { AppServer, AppSocket } from '../types';

/**
 * Realtime handler for the heart "wave" interaction that fires
 * when a viewer taps the heart on someone else's pin in the
 * Globe component.
 *
 * Flow:
 *   1. Sender's Globe.tsx emits `wave:send` over the socket
 *      with `{ targetUserId }`. The local burst over the
 *      recipient's marker is rendered immediately on the
 *      sender's screen (see Globe `spawnHeartsAtMarker`); the
 *      server roundtrip below is what propagates the wave to
 *      the receiver.
 *   2. This handler inserts a `notifications` row with
 *      `kind: 'waved'` so the recipient's NotificationBell + the
 *      `/api/notifications` list picks it up after a refresh.
 *   3. Emits `notify:new` to the recipient's personal room
 *      (`user:${targetUserId}`) so the receiver's client both
 *      refreshes the notification list AND fires the
 *      `app:hearts-cascade` overlay locally. Per product
 *      feedback "Estou com dois usuários online e as
 *      notificações de coração só aparecem para o usuário que
 *      fez, o que recebeu não chegou".
 *
 * Rate-limiting / dedup is intentionally minimal at this stage
 * — the wave is cheap, idempotency isn't critical for the mock,
 * and adding it now would deepen the diff. Future hardening
 * spot: collapse repeated waves within a short window into a
 * single notification.
 */

const userRoom = (userId: string) => `user:${userId}`;

const waveSchema = z.object({
  targetUserId: z.string().uuid(),
});

export function registerWaveHandlers(io: AppServer, socket: AppSocket): void {
  const senderId = socket.data.userId;

  socket.on(
    'wave:send',
    async (
      input: unknown,
      ack?: (resp: { ok: boolean; error?: string }) => void,
    ) => {
      try {
        const parsed = waveSchema.safeParse(input);
        if (!parsed.success) {
          ack?.({ ok: false, error: 'invalid_payload' });
          return;
        }
        const { targetUserId } = parsed.data;

        // Self-waves are no-ops — the sender's UI shouldn't even
        // expose a heart on their own marker, but defend at the
        // boundary anyway.
        if (targetUserId === senderId) {
          ack?.({ ok: false, error: 'self_wave' });
          return;
        }

        // Confirm the recipient exists before inserting (foreign
        // key would catch this anyway, but failing fast keeps the
        // error path cleaner).
        const target = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, targetUserId))
          .limit(1);

        if (target.length === 0) {
          ack?.({ ok: false, error: 'recipient_not_found' });
          return;
        }

        // Persist the notification so it survives reloads + shows
        // in the bell. The payload is intentionally bare — the
        // recipient already has the sender's id, name, and
        // avatarUrl via the JOIN inside listNotifications().
        const [inserted] = await db
          .insert(notifications)
          .values({
            userId: targetUserId,
            kind: 'waved' as const,
            sourceUserId: senderId,
          })
          .returning({ id: notifications.id });

        // Look up the sender's identity so the receiver's client
        // can render the toast / unread state without a follow-up
        // REST roundtrip for the source-user join.
        const [sender] = await db
          .select({
            id: users.id,
            name: users.name,
            avatarUrl: users.avatarUrl,
          })
          .from(users)
          .where(eq(users.id, senderId))
          .limit(1);

        io.to(userRoom(targetUserId)).emit('notify:new', {
          id: inserted.id,
          kind: 'waved',
          sourceUserId: senderId,
          sourceName: sender?.name ?? null,
          sourceAvatarUrl: sender?.avatarUrl ?? null,
        });

        ack?.({ ok: true });
      } catch (err) {
        console.error('[wave:send] handler failed:', err);
        ack?.({ ok: false, error: 'send_failed' });
      }
    },
  );
}
