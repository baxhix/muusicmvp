import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  listeningHistory,
  notifications,
  nowPlaying,
  tracks,
  type Track,
} from '../db/schema';

const SAME_TRACK_WINDOW_MS = 2 * 60 * 1000; // 2 min: count as "listening together"
const SAME_TRACK_DEDUPE_MS = 60 * 60 * 1000; // 1h: don't re-notify same pair+track

/** Look up a track by youtubeId. Returns null if not in catalog. */
export async function findTrackByYoutubeId(youtubeId: string): Promise<Track | null> {
  const rows = await db
    .select()
    .from(tracks)
    .where(eq(tracks.youtubeId, youtubeId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Apply a listening "tick" — idempotent state update.
 * Returns whether the track changed (caller may want to fire notifications).
 */
export async function recordListeningTick(
  userId: string,
  trackId: string,
  positionSeconds: number,
  isPaused: boolean,
): Promise<{ trackChanged: boolean }> {
  // Fetch current state.
  const current = await db
    .select()
    .from(nowPlaying)
    .where(eq(nowPlaying.userId, userId))
    .limit(1);

  const trackChanged = !current[0] || current[0].trackId !== trackId;

  if (trackChanged) {
    // Close previous open history row (if any).
    await db
      .update(listeningHistory)
      .set({ endedAt: new Date() })
      .where(
        and(
          eq(listeningHistory.userId, userId),
          isNull(listeningHistory.endedAt),
        ),
      );

    // Open new history row.
    await db.insert(listeningHistory).values({
      userId,
      trackId,
      startedAt: new Date(),
      durationListenedSeconds: 0,
    });
  } else {
    // Same track: update duration on the currently-open row.
    await db
      .update(listeningHistory)
      .set({ durationListenedSeconds: positionSeconds })
      .where(
        and(
          eq(listeningHistory.userId, userId),
          eq(listeningHistory.trackId, trackId),
          isNull(listeningHistory.endedAt),
        ),
      );
  }

  // Upsert now_playing.
  await db
    .insert(nowPlaying)
    .values({
      userId,
      trackId,
      startedAt: trackChanged ? new Date() : current[0].startedAt,
      positionSeconds: Math.floor(positionSeconds),
      isPaused,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: nowPlaying.userId,
      set: {
        trackId,
        startedAt: sql`CASE WHEN ${nowPlaying.trackId} = ${trackId} THEN ${nowPlaying.startedAt} ELSE NOW() END`,
        positionSeconds: Math.floor(positionSeconds),
        isPaused,
        updatedAt: new Date(),
      },
    });

  return { trackChanged };
}

/** Close any open listening rows and clear the user's now_playing. */
export async function stopListening(userId: string): Promise<void> {
  await db
    .update(listeningHistory)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(listeningHistory.userId, userId),
        isNull(listeningHistory.endedAt),
      ),
    );

  await db.delete(nowPlaying).where(eq(nowPlaying.userId, userId));
}

/**
 * Find other users currently listening to the same track and create
 * `same_track` notifications BOTH WAYS (de-duped per directed pair within 1h):
 *   - For every other user B currently on the same track: notify B about A
 *     (the source) AND notify A about B.
 *
 * Returns the list of created notifications so realtime can push them.
 */
export async function notifySameTrackListeners(
  sourceUserId: string,
  trackId: string,
): Promise<Array<{ userId: string; notificationId: string }>> {
  const since = new Date(Date.now() - SAME_TRACK_WINDOW_MS);

  // Other users currently on this track.
  const others = await db
    .select({ userId: nowPlaying.userId })
    .from(nowPlaying)
    .where(
      and(
        eq(nowPlaying.trackId, trackId),
        ne(nowPlaying.userId, sourceUserId),
        gt(nowPlaying.updatedAt, since),
      ),
    );

  if (others.length === 0) return [];

  const dedupeCutoff = new Date(Date.now() - SAME_TRACK_DEDUPE_MS);
  const created: Array<{ userId: string; notificationId: string }> = [];

  /** Insert one same_track notification (target ← source) if not deduped. */
  async function notifyOnce(targetUserId: string, fromUserId: string) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, targetUserId),
          eq(notifications.kind, 'same_track'),
          eq(notifications.sourceUserId, fromUserId),
          eq(notifications.trackId, trackId),
          gt(notifications.createdAt, dedupeCutoff),
        ),
      )
      .limit(1);
    if (existing.length) return;

    const inserted = await db
      .insert(notifications)
      .values({
        userId: targetUserId,
        kind: 'same_track',
        sourceUserId: fromUserId,
        trackId,
      })
      .returning({ id: notifications.id });

    if (inserted[0]) {
      created.push({ userId: targetUserId, notificationId: inserted[0].id });
    }
  }

  for (const { userId: otherId } of others) {
    // Bilateral: notify the OTHER about the source, AND the source about the other.
    await notifyOnce(otherId, sourceUserId);
    await notifyOnce(sourceUserId, otherId);
  }

  return created;
}

/** List notifications for a user — unread first, then recent read. */
export async function listNotifications(userId: string, limit = 50) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows;
}

/** Mark a single notification read (no-op if not owned by user). */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
    .returning({ id: notifications.id });
  return result.length > 0;
}

