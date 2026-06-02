import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  listeningHistory,
  trackLikes,
  userActivities,
} from '../db/schema';

/**
 * Stable id per mission so the client can stitch icons + labels +
 * XP locally without the server having to ship presentation data.
 */
export type DailyMissionId =
  | 'listen_5'      // listen to 5 distinct tracks today
  | 'like_track'    // like (heart) at least 1 track today
  | 'start_chat'    // start a new DM today
  | 'daily_login'   // be present today (auto-completed: they hit
                    // the endpoint, so they ARE logged in today)
  /* IDs display-only no ArtistBox (mock visual, sem tracking
   * server-side ainda). Adicionados no union pra alinhar tipos
   * entre client/server; queries que mapeiam por id simplesmente
   * não vão encontrá-los e os retornam como não-completados. */
  | 'share_song'
  | 'follow_artist';

export interface DailyMission {
  id: DailyMissionId;
  /** Current count of qualifying events today. */
  progress: number;
  /** Target needed to mark the mission as done. */
  target: number;
  /** Derived from progress >= target — saves the client one comparison. */
  done: boolean;
}

/**
 * Run four queries against the existing activity tables and return
 * the user's progress on each daily mission. "Today" is the calendar
 * day in server TZ (date_trunc('day', now())).
 *
 * Cost: ~4 indexed point lookups per call. The route caller is the
 * ArtistBox card which mounts once per /app session, so this is
 * cheap; if we ever need to scale to "every page render" we'd add
 * a 60s cache layer.
 */
export async function getDailyMissions(
  userId: string,
): Promise<DailyMission[]> {
  // Mission 1 — listen_5: count distinct tracks today.
  const listenRows = await db.execute(sql`
    SELECT COUNT(DISTINCT track_id)::int AS n
    FROM ${listeningHistory}
    WHERE user_id = ${userId}::uuid
      AND started_at >= date_trunc('day', now())
  `);
  const tracksToday = (listenRows.rows[0]?.n as number | undefined) ?? 0;

  // Mission 2 — like_track: any track_likes row today.
  const likeRows = await db
    .select({ x: sql<number>`1` })
    .from(trackLikes)
    .where(
      and(
        eq(trackLikes.userId, userId),
        gte(
          trackLikes.createdAt,
          sql<Date>`date_trunc('day', now())`,
        ),
      ),
    )
    .limit(1);

  // Mission 3 — start_chat: any user_activities row kind='chat_started' today.
  const chatRows = await db
    .select({ x: sql<number>`1` })
    .from(userActivities)
    .where(
      and(
        eq(userActivities.userId, userId),
        eq(userActivities.kind, 'chat_started'),
        gte(
          userActivities.createdAt,
          sql<Date>`date_trunc('day', now())`,
        ),
      ),
    )
    .limit(1);

  // Mission 4 — daily_login: auto-completed. Reaching this code
  // path means the user is authenticated + active.
  const out: DailyMission[] = [
    { id: 'listen_5',    progress: Math.min(tracksToday, 5), target: 5, done: tracksToday >= 5 },
    { id: 'like_track',  progress: likeRows.length, target: 1, done: likeRows.length > 0 },
    { id: 'start_chat',  progress: chatRows.length, target: 1, done: chatRows.length > 0 },
    { id: 'daily_login', progress: 1, target: 1, done: true },
  ];
  return out;
}
