import { sql, gt, count } from 'drizzle-orm';
import { db } from '../db';
import {
  conversations,
  listeningHistory,
  messages,
  notifications,
  tracks,
  users,
} from '../db/schema';

const ONLINE_WINDOW_MS = 60_000;

/** High-level KPIs for the admin dashboard. */
export async function getAdminKpis() {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);

  const [
    [{ value: totalUsers }],
    [{ value: onlineUsers }],
    [{ value: totalMessages }],
    [{ value: totalTracks }],
    [{ value: totalListeningEvents }],
    [{ value: totalConversations }],
    [{ value: unreadNotifications }],
  ] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(users).where(gt(users.lastSeenAt, since)),
    db.select({ value: count() }).from(messages),
    db.select({ value: count() }).from(tracks),
    db.select({ value: count() }).from(listeningHistory),
    db.select({ value: count() }).from(conversations),
    db
      .select({ value: count() })
      .from(notifications)
      .where(sql`${notifications.readAt} IS NULL`),
  ]);

  return {
    totalUsers,
    onlineUsers,
    totalMessages,
    totalTracks,
    totalListeningEvents,
    totalConversations,
    unreadNotifications,
  };
}

/** Paginated list of all users with their last-seen + city. */
export async function listAllUsers(opts: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      city: users.city,
      country: users.country,
      avatarUrl: users.avatarUrl,
      role: users.role,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  const [{ value: total }] = await db.select({ value: count() }).from(users);

  return { users: rows, total };
}

/** Top tracks by listening count in the past N days. */
export async function topTracks(days = 30, limit = 20) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT
      t.id          AS track_id,
      t.title       AS title,
      t.artist      AS artist,
      t.youtube_id  AS youtube_id,
      COUNT(*)::int AS plays,
      COUNT(DISTINCT lh.user_id)::int AS unique_listeners
    FROM listening_history lh
    JOIN tracks t ON t.id = lh.track_id
    WHERE lh.started_at >= ${since}
    GROUP BY t.id, t.title, t.artist, t.youtube_id
    ORDER BY plays DESC
    LIMIT ${limit}
  `);
  return rows.rows.map((r) => ({
    trackId: r.track_id as string,
    title: r.title as string,
    artist: r.artist as string,
    youtubeId: r.youtube_id as string,
    plays: r.plays as number,
    uniqueListeners: r.unique_listeners as number,
  }));
}

/** Daily new-user counts for the past N days (oldest → newest). */
export async function userGrowth(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.execute(sql`
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS new_users
    FROM users
    WHERE created_at >= ${since}
    GROUP BY day
    ORDER BY day ASC
  `);
  return rows.rows.map((r) => ({
    day: r.day as string,
    newUsers: r.new_users as number,
  }));
}
