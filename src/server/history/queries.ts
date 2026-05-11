import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { trackLikes } from '../db/schema';

export interface HistoryRow {
  trackId: string;
  title: string;
  artist: string;
  youtubeId: string;
  lastPlayedAt: string;   // ISO
  plays: number;
  liked: boolean;
}

/**
 * Distinct-by-track listening history, ordered by the most-recent listen
 * first. Each row aggregates total plays of that track + whether the user
 * has liked it. Paginate with the `before` cursor (lastPlayedAt of the
 * oldest row received).
 */
export async function getListeningHistory(
  userId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<{ items: HistoryRow[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

  const cursor = opts.before ? opts.before.toISOString() : null;

  const result = await db.execute(sql`
    SELECT
      t.id          AS track_id,
      t.title       AS title,
      t.artist      AS artist,
      t.youtube_id  AS youtube_id,
      MAX(lh.started_at) AS last_played_at,
      COUNT(*)::int      AS plays,
      EXISTS (
        SELECT 1 FROM track_likes tl
        WHERE tl.user_id = ${userId} AND tl.track_id = t.id
      ) AS liked
    FROM listening_history lh
    JOIN tracks t ON t.id = lh.track_id
    WHERE lh.user_id = ${userId}
    GROUP BY t.id, t.title, t.artist, t.youtube_id
    ${cursor ? sql`HAVING MAX(lh.started_at) < ${cursor}` : sql``}
    ORDER BY last_played_at DESC
    LIMIT ${limit + 1}
  `);

  const rows = result.rows.slice(0, limit).map(
    (r): HistoryRow => ({
      trackId: r.track_id as string,
      title: r.title as string,
      artist: r.artist as string,
      youtubeId: r.youtube_id as string,
      lastPlayedAt: (r.last_played_at as Date).toISOString(),
      plays: r.plays as number,
      liked: r.liked as boolean,
    }),
  );

  return { items: rows, hasMore: result.rows.length > limit };
}

/** Like a track. Idempotent — no-op if already liked. */
export async function likeTrack(userId: string, trackId: string): Promise<void> {
  await db
    .insert(trackLikes)
    .values({ userId, trackId })
    .onConflictDoNothing({ target: [trackLikes.userId, trackLikes.trackId] });
}

/** Unlike a track. Returns whether a row was actually deleted. */
export async function unlikeTrack(userId: string, trackId: string): Promise<boolean> {
  const deleted = await db
    .delete(trackLikes)
    .where(
      and(eq(trackLikes.userId, userId), eq(trackLikes.trackId, trackId)),
    )
    .returning({ userId: trackLikes.userId });
  return deleted.length > 0;
}
