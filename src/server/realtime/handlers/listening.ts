import { z } from 'zod';
import {
  findTrackByYoutubeId,
  notifySameTrackListeners,
  recordListeningTick,
  stopListening,
} from '../../listening/queries';
import type { AppServer, AppSocket } from '../types';

const tickSchema = z.object({
  youtubeId: z.string().min(1),
  positionSeconds: z.number().min(0).max(60 * 60 * 6),
  isPaused: z.boolean().default(false),
});

const userRoom = (userId: string) => `user:${userId}`;

export function registerListeningHandlers(io: AppServer, socket: AppSocket): void {
  const userId = socket.data.userId;

  socket.on('listening:tick', async (input: unknown) => {
    const parsed = tickSchema.safeParse(input);
    if (!parsed.success) return;

    const track = await findTrackByYoutubeId(parsed.data.youtubeId);
    if (!track) return;

    const { trackChanged } = await recordListeningTick(
      userId,
      track.id,
      parsed.data.positionSeconds,
      parsed.data.isPaused,
    );

    if (!trackChanged) return;

    const created = await notifySameTrackListeners(userId, track.id);

    // Operational visibility — easy to grep in `docker compose logs socket`
    // when notifications aren't behaving. Includes the count so we can tell
    // 'no overlap' from 'every pair was already deduped'.
    console.log(
      `[listening] user=${userId} → track=${track.id} (${track.title}); same-track notifications created: ${created.length}`,
    );

    // Push real-time notify events to each matched user's personal room.
    for (const { userId: targetUserId, notificationId } of created) {
      io.to(userRoom(targetUserId)).emit('notify:new', {
        id: notificationId,
        kind: 'same_track',
        sourceUserId: userId,
        trackId: track.id,
      });
    }
  });

  socket.on('listening:stop', async () => {
    await stopListening(userId);
  });
}
