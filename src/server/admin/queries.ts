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

/**
 * Shape consumed by the admin "Usuários" table. Maps real DB fields
 * 1:1 where we have them; fills sensible defaults for fields the
 * backend doesn't track yet (age/sex/phone/plan/status/etc.).
 *
 * Kept here (not in admin/src) so the API contract is server-owned —
 * future expansion of stored fields just relaxes the defaults.
 */
export interface AdminUserRow {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatar: string | null;
  role: 'fan' | 'creator';
  status: 'active';
  plan: 'free';
  age: number;
  sex: 'NaoInformado';
  phone: string;
  city: string;
  state: string;
  lastStream: {
    title: string;
    artist?: string;
    playedAt: string;
  } | null;
  streamHistory: never[];
  totalStreams: number;
  fanpoints: number;
  level: number;
  totalSpentBRL: number;
  followers: number;
  following: number;
  posts: number;
  termsAcceptedAt: string;
  createdAt: string;
  lastActiveAt: string;
  isOnline: boolean;
  verified: boolean;
}

/**
 * Levels match the admin/UI ranking buckets used elsewhere — derived
 * from fanpoints so the admin sees the same number the user sees on
 * their own profile.
 */
function levelFromFanpoints(points: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, points) / 100)) + 1);
}

function handleFromEmail(email: string): string {
  return email.split('@')[0] ?? 'user';
}

/**
 * db.execute(sql`...`) returns timestamp columns as STRINGS (ISO),
 * not Date objects — unlike the typed query builder which coerces
 * to Date via Drizzle's type system. So calling `.toISOString()`
 * directly on the value throws "X.toISOString is not a function"
 * in production builds (where TS casts are erased).
 *
 * This helper handles both shapes defensively + returns null when
 * the column was NULL, instead of producing "Invalid Date" strings.
 */
function asIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/** Same coercion as asIso, but yields a millisecond epoch — for time math. */
function asEpoch(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

/**
 * Paginated list of registered users — joins last-stream + totals so
 * the admin table can render the same row the production query
 * returns without any extra round-trip per user.
 */
export async function listAllUsers(opts: { limit?: number; offset?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.name,
      u.city,
      u.country,
      u.country_code,
      u.avatar_url,
      u.role,
      u.created_at,
      u.last_seen_at,
      ls.title       AS last_stream_title,
      ls.artist      AS last_stream_artist,
      ls.played_at   AS last_stream_played_at,
      COALESCE(s.total, 0)::int  AS total_streams,
      COALESCE(p.total, 0)::int  AS fanpoints
    FROM users u
    LEFT JOIN LATERAL (
      SELECT t.title, t.artist, a.created_at AS played_at
      FROM user_activities a
      JOIN tracks t ON t.id = a.track_id
      WHERE a.user_id = u.id AND a.kind = 'stream'
      ORDER BY a.created_at DESC
      LIMIT 1
    ) ls ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS total
      FROM user_activities
      WHERE user_id = u.id AND kind = 'stream'
    ) s ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(points), 0)::int AS total
      FROM user_activities
      WHERE user_id = u.id
    ) p ON TRUE
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const onlineSinceMs = Date.now() - ONLINE_WINDOW_MS;

  const items: AdminUserRow[] = rows.rows.map((r) => {
    const createdAt = asIso(r.created_at) ?? new Date().toISOString();
    const lastSeenAt = asIso(r.last_seen_at) ?? createdAt;
    const lastSeenMs = asEpoch(r.last_seen_at);
    const fanpoints = (r.fanpoints as number) ?? 0;
    const email = r.email as string;
    const name = (r.name as string | null)?.trim() || handleFromEmail(email);
    const playedAt = asIso(r.last_stream_played_at);

    return {
      id: r.id as string,
      name,
      handle: handleFromEmail(email),
      email,
      avatar: (r.avatar_url as string | null) ?? null,
      // Real DB role is 'user' | 'admin'; the admin UI splits the user
      // population into 'fan' vs 'creator' for visual grouping. Until
      // we model creators explicitly, every regular user reads as 'fan'
      // and admins also display as 'fan' since the table isn't the
      // place to single them out — that's the responsibility of the
      // permissions tab elsewhere.
      role: 'fan',
      status: 'active',
      plan: 'free',
      age: 0,
      sex: 'NaoInformado',
      phone: '',
      city: (r.city as string | null) ?? '',
      state: (r.country_code as string | null) ?? '',
      lastStream:
        r.last_stream_title && playedAt
          ? {
              title: r.last_stream_title as string,
              artist: (r.last_stream_artist as string | undefined) ?? undefined,
              playedAt,
            }
          : null,
      streamHistory: [],
      totalStreams: (r.total_streams as number) ?? 0,
      fanpoints,
      level: levelFromFanpoints(fanpoints),
      totalSpentBRL: 0,
      followers: 0,
      following: 0,
      posts: 0,
      termsAcceptedAt: createdAt,
      createdAt,
      lastActiveAt: lastSeenAt,
      isOnline: lastSeenMs !== null && lastSeenMs >= onlineSinceMs,
      verified: false,
    };
  });

  const [{ value: total }] = await db.select({ value: count() }).from(users);

  return { users: items, total };
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
