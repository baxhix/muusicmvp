import { z } from 'zod';
import { inArray } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
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

    console.log(
      `[listening] user=${userId} → track=${track.id} (${track.title}); same-track notifications created: ${created.length}`,
    );

    if (created.length === 0) return;

    // Batch-fetch source-user details so every emit carries enough data
    // for the receiver to render a toast without a follow-up REST hop.
    const sourceIds = Array.from(new Set(created.map((c) => c.sourceUserId)));
    const sources = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(inArray(users.id, sourceIds));
    const sourceById = new Map(sources.map((u) => [u.id, u]));

    for (const c of created) {
      const src = sourceById.get(c.sourceUserId);
      io.to(userRoom(c.userId)).emit('notify:new', {
        id: c.notificationId,
        kind: 'same_track',
        sourceUserId: c.sourceUserId,
        sourceName: src?.name ?? null,
        sourceEmail: src?.email ?? null,
        sourceAvatarUrl: src?.avatarUrl ?? null,
        trackId: track.id,
        trackTitle: track.title,
        trackArtist: track.artist,
        trackYoutubeId: track.youtubeId,
      });
    }
  });

  socket.on('listening:stop', async () => {
    await stopListening(userId);
  });
}
