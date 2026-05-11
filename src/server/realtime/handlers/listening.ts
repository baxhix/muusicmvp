import { z } from 'zod';
import { inArray } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { getSuperchatId } from '../../chat/dm';
import { POINTS } from '../../activities/queries';
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
    try {
      const parsed = tickSchema.safeParse(input);
      if (!parsed.success) return;

      const track = await findTrackByYoutubeId(parsed.data.youtubeId);
      if (!track) {
        // Surface in logs — a user playing a YouTube ID we never seeded
        // means their listening will be invisible to history, ranking
        // and same-track matching. Easy to miss without this hint.
        console.warn(
          `[listening:tick] user=${userId} played unknown youtubeId=${parsed.data.youtubeId} — not in tracks catalog, skipping`,
        );
        return;
      }

      const { trackChanged } = await recordListeningTick(
        userId,
        track.id,
        parsed.data.positionSeconds,
        parsed.data.isPaused,
      );

      if (!trackChanged) return;

      // Poke the listening user's own client so the Histórico /
      // Minha Atividade views refresh live. notify:new is reserved
      // for same-track notifications fanned out to OTHER users —
      // it never fires for the source of the listen, so without
      // this self-event an open Profile panel would stay stale
      // until manually closed and reopened.
      io.to(userRoom(userId)).emit('me:activity:new', {
        kind: 'stream',
        trackId: track.id,
        createdAt: new Date().toISOString(),
      });

      // ── Broadcast a small system message to Superchat: "X tocou Y +100"
      // Fire-and-forget (catch logs only). Skipped on conv-id lookup failure.
      try {
        const superchatId = await getSuperchatId();
        if (superchatId) {
          io.to(`conv:${superchatId}`).emit('chat:activity', {
            kind: 'stream',
            conversationId: superchatId,
            userId,
            userName: socket.data.userName ?? null,
            points: POINTS.stream,
            trackTitle: track.title,
            trackArtist: track.artist,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error('[listening:tick] superchat activity emit failed:', err);
      }

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
    } catch (err) {
      // Catch-all so a transient DB hiccup or constraint violation doesn't
      // crash the realtime process and drop every active socket connection.
      console.error('[listening:tick] handler failed:', err);
    }
  });

  socket.on('listening:stop', async () => {
    try {
      await stopListening(userId);
    } catch (err) {
      console.error('[listening:stop] handler failed:', err);
    }
  });
}
