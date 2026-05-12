import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { userActivities } from '../db/schema';

export type ActivityKind = 'stream' | 'login' | 'chat_started';

export const POINTS: Record<ActivityKind, number> = {
  stream: 100,
  login: 50,
  chat_started: 200,
};

/**
 * Append a single point-bearing activity. Safe to fire-and-forget — failures
 * are logged but don't propagate to the caller (we don't want a missed
 * audit row to break a chat send or a song change).
 *
 * Returns the milestones crossed by this single activity so callers can
 * emit celebratory events (confetti + social toast). Empty array on the
 * common case where no threshold was breached, or on an insert failure.
 */
export async function recordActivity(
  userId: string,
  kind: ActivityKind,
  ctx: { trackId?: string; conversationId?: string } = {},
): Promise<{ crossedMilestones: number[]; newTotal: number }> {
  try {
    await db.insert(userActivities).values({
      userId,
      kind,
      points: POINTS[kind],
      trackId: ctx.trackId ?? null,
      conversationId: ctx.conversationId ?? null,
    });
    // After persistence, derive the user's running total and figure
    // out which milestones (if any) the activity just unlocked. Pre-
    // activity total is `newTotal - thisActivityPoints`, so threshold
    // crossings are clean to compute without an extra read.
    const newTotal = await getUserPoints(userId);
    const prev = Math.max(0, newTotal - POINTS[kind]);
    return { crossedMilestones: findCrossedMilestones(prev, newTotal), newTotal };
  } catch (err) {
    console.error('recordActivity failed:', { userId, kind, err });
    return { crossedMilestones: [], newTotal: 0 };
  }
}

/**
 * Point milestones we celebrate. 500 is the first "you're getting
 * somewhere" recognition; after that every kilopoint is its own beat.
 * Encoded as a generator so the list scales without a hardcoded cap.
 */
export function findCrossedMilestones(prev: number, current: number): number[] {
  if (current <= prev) return [];
  const out: number[] = [];
  // Special case: the very first milestone at 500.
  if (prev < 500 && current >= 500) out.push(500);
  // Then every full kilopoint crossed.
  const prevK = Math.max(0, Math.floor(prev / 1000));
  const currK = Math.floor(current / 1000);
  for (let k = prevK + 1; k <= currK; k++) {
    out.push(k * 1000);
  }
  return out;
}

export interface RankingRow {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  streams: number;
  logins: number;
  chatsStarted: number;
  points: number;
}

/**
 * Global leaderboard — total points across all users. Streams are counted
 * separately so the UI can show them next to points (per the spec).
 *
 * Users with zero activity are still included (LEFT JOIN) so a fresh user
 * doesn't disappear from search. The ORDER + LIMIT keeps the modal lean.
 */
export async function getRanking(limit = 100): Promise<RankingRow[]> {
  const result = await db.execute(sql`
    SELECT
      u.id           AS user_id,
      u.name         AS name,
      u.email        AS email,
      u.avatar_url   AS avatar_url,
      u.city         AS city,
      u.country      AS country,
      COUNT(*) FILTER (WHERE a.kind = 'stream')::int       AS streams,
      COUNT(*) FILTER (WHERE a.kind = 'login')::int        AS logins,
      COUNT(*) FILTER (WHERE a.kind = 'chat_started')::int AS chats_started,
      COALESCE(SUM(a.points), 0)::int                      AS points
    FROM users u
    LEFT JOIN user_activities a ON a.user_id = u.id
    GROUP BY u.id, u.name, u.email, u.avatar_url, u.city, u.country
    ORDER BY points DESC, streams DESC, u.created_at ASC
    LIMIT ${limit}
  `);

  return result.rows.map((r) => ({
    userId: r.user_id as string,
    name: r.name as string | null,
    email: r.email as string,
    avatarUrl: r.avatar_url as string | null,
    city: r.city as string | null,
    country: r.country as string | null,
    streams: r.streams as number,
    logins: r.logins as number,
    chatsStarted: r.chats_started as number,
    points: r.points as number,
  }));
}

export interface MyActivityRow {
  id: string;
  kind: ActivityKind;
  points: number;
  createdAt: string;
  trackTitle: string | null;
  trackArtist: string | null;
  conversationSlug: string | null;
}

/**
 * Current user's activity ledger, newest first. Hydrated with track and
 * conversation labels so the UI can render "Tocou Boiadeira" or "Iniciou
 * conversa" without a second roundtrip.
 */
export async function getUserActivities(
  userId: string,
  opts: { limit?: number; before?: Date } = {},
): Promise<{ items: MyActivityRow[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const cursor = opts.before ? opts.before.toISOString() : null;

  const result = await db.execute(sql`
    SELECT
      a.id           AS id,
      a.kind         AS kind,
      a.points       AS points,
      a.created_at   AS created_at,
      t.title        AS track_title,
      t.artist       AS track_artist,
      c.slug         AS conversation_slug
    FROM user_activities a
    LEFT JOIN tracks t        ON t.id = a.track_id
    LEFT JOIN conversations c ON c.id = a.conversation_id
    WHERE a.user_id = ${userId}
    ${cursor ? sql`AND a.created_at < ${cursor}` : sql``}
    ORDER BY a.created_at DESC
    LIMIT ${limit + 1}
  `);

  const rows = result.rows.slice(0, limit).map(
    (r): MyActivityRow => ({
      id: r.id as string,
      kind: r.kind as ActivityKind,
      points: r.points as number,
      createdAt: (r.created_at as Date).toISOString(),
      trackTitle: r.track_title as string | null,
      trackArtist: r.track_artist as string | null,
      conversationSlug: r.conversation_slug as string | null,
    }),
  );

  return { items: rows, hasMore: result.rows.length > limit };
}

/** Sum of points for a single user. Useful for badges / TopBar pills. */
export async function getUserPoints(userId: string): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${userActivities.points}), 0)::int`,
    })
    .from(userActivities)
    .where(eq(userActivities.userId, userId));
  return result[0]?.total ?? 0;
}

