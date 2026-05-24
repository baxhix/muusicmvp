import { sql, gt, count, and } from 'drizzle-orm';
import { db } from '../db';
import {
  conversations,
  listeningHistory,
  messages,
  notifications,
  tracks,
  users,
} from '../db/schema';
import { env } from '../env';

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
    // LGPD: KPIs ignoram soft-deleted (não inflam contagem
    // depois do usuário pedir exclusão).
    db.select({ value: count() }).from(users).where(sql`${users.deletedAt} IS NULL`),
    db
      .select({ value: count() })
      .from(users)
      .where(and(gt(users.lastSeenAt, since), sql`${users.deletedAt} IS NULL`)),
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
 * Convert the relative paths the backend persists for uploaded
 * avatars (`/api/avatars/<filename>`) into absolute URLs so admin
 * clients hosted on a different subdomain (admin.muusic.live) can
 * load them. Absolute URLs (Spotify CDN, pravatar fallbacks) pass
 * through untouched. Returns null only when the input is empty.
 */
function absoluteAvatar(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
  if (raw.startsWith('/')) {
    return env.APP_URL ? `${env.APP_URL}${raw}` : raw;
  }
  return raw;
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
    -- LGPD: usuário soft-deleted some da listagem admin imediatamente.
    -- A row continua no DB pelo período de retenção (anonimizada
    -- após N dias via cron), mas operador não precisa ver a entrada
    -- na tabela principal.
    WHERE u.deleted_at IS NULL
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
      avatar: absoluteAvatar(r.avatar_url as string | null),
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
/**
 * Shape the admin Superfãs table consumes. Maps user identity + the
 * existing ranking aggregates and synthesizes a couple of fields the
 * UI needs but the backend doesn't track yet (totalSpentBRL,
 * totalListenMinutes, tags). Synthesis is honest — listening minutes
 * are estimated as `streams * 3` (rough avg track length) and spent
 * amount is 0 until billing exists.
 */
export interface AdminSuperfanRow {
  id: string;
  user: {
    id: string;
    name: string;
    handle: string;
    avatar: string | null;
    city: string;
    state: string;
  };
  rank: number;
  fanpoints: number;
  totalSpentBRL: number;
  totalListenMinutes: number;
  interactions: number;
  daysActive: number;
  joinedAt: string;
  tags: string[];
}

/**
 * Top users by total points, hydrated with the identity fields the
 * admin Superfãs table needs (handle, city/state, joinedAt, etc.).
 * Mirrors the in-app /api/ranking response but with admin-friendly
 * shape so the table renders with zero further mapping on the client.
 */
export async function getSuperfansForAdmin(limit = 100): Promise<AdminSuperfanRow[]> {
  const result = await db.execute(sql`
    SELECT
      u.id           AS user_id,
      u.email        AS email,
      u.name         AS name,
      u.avatar_url   AS avatar_url,
      u.city         AS city,
      u.country_code AS country_code,
      u.created_at   AS created_at,
      COUNT(*) FILTER (WHERE a.kind = 'stream')::int  AS streams,
      COUNT(*) FILTER (WHERE a.kind = 'login')::int   AS logins,
      COUNT(*) FILTER (WHERE a.kind = 'chat_started')::int AS chats_started,
      COALESCE(SUM(a.points), 0)::int                  AS points
    FROM users u
    LEFT JOIN user_activities a ON a.user_id = u.id
    GROUP BY u.id, u.email, u.name, u.avatar_url, u.city, u.country_code, u.created_at
    ORDER BY points DESC, streams DESC, u.created_at ASC
    LIMIT ${limit}
  `);

  const now = Date.now();
  return result.rows.map((r, i): AdminSuperfanRow => {
    const email = r.email as string;
    const name = (r.name as string | null)?.trim() || handleFromEmail(email);
    const points = (r.points as number) ?? 0;
    const streams = (r.streams as number) ?? 0;
    const logins = (r.logins as number) ?? 0;
    const chatsStarted = (r.chats_started as number) ?? 0;
    const createdAtMs = asEpoch(r.created_at) ?? now;
    const joinedAt = asIso(r.created_at) ?? new Date().toISOString();
    const daysActive = Math.max(
      1,
      Math.floor((now - createdAtMs) / (24 * 60 * 60 * 1000)),
    );

    return {
      id: r.user_id as string,
      user: {
        id: r.user_id as string,
        name,
        handle: handleFromEmail(email),
        avatar: absoluteAvatar(r.avatar_url as string | null),
        city: (r.city as string | null) ?? '',
        state: (r.country_code as string | null) ?? '',
      },
      rank: i + 1,
      fanpoints: points,
      totalSpentBRL: 0,
      // Rough estimate: 3 min average track length × number of streams.
      // Replace with real SUM(duration_listened_seconds) when the listen
      // history starts to carry useful duration data per row.
      totalListenMinutes: streams * 3,
      // Counts every point-bearing action the user took.
      interactions: streams + logins + chatsStarted,
      daysActive,
      joinedAt,
      tags: [],
    };
  });
}

/**
 * Engagement snapshot — counts the platform's social activity in a
 * single round trip. Each kpi maps to a concept the engagement page
 * surfaces; values are computed cheaply (COUNT(*) on indexed cols).
 *
 * For metrics we don't yet instrument (chat dwell time, pins visited,
 * community participation), the admin page renders "em breve" tiles
 * without a server hit — this endpoint is intentionally scoped to
 * what's measurable today, so the dashboard never lies.
 */
export interface AdminEngagement {
  totalMessages: number;
  totalReactions: number;
  chatsStarted: number;
  superchatParticipants: number;
  /** Daily message volume for the past N days (oldest → newest). */
  messagesPerDay: Array<{ day: string; count: number }>;
}

export async function getEngagement(days = 30): Promise<AdminEngagement> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [counts, perDay] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM messages)                                  AS total_messages,
        (SELECT COUNT(*)::int FROM message_reactions)                         AS total_reactions,
        (SELECT COUNT(*)::int FROM user_activities WHERE kind = 'chat_started') AS chats_started,
        (SELECT COUNT(*)::int FROM conversation_participants cp
           JOIN conversations c ON c.id = cp.conversation_id
           WHERE c.type = 'group')                                            AS superchat_participants
    `),
    db.execute(sql`
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS count
      FROM messages
      WHERE created_at >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `),
  ]);
  const row = counts.rows[0] as {
    total_messages: number;
    total_reactions: number;
    chats_started: number;
    superchat_participants: number;
  };
  return {
    totalMessages: row.total_messages ?? 0,
    totalReactions: row.total_reactions ?? 0,
    chatsStarted: row.chats_started ?? 0,
    superchatParticipants: row.superchat_participants ?? 0,
    messagesPerDay: perDay.rows.map((r) => ({
      day: r.day as string,
      count: r.count as number,
    })),
  };
}

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
