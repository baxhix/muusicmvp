import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { requireAdmin } from '@/server/auth/requireAdmin';

export const runtime = 'nodejs';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().datetime().optional(),
});

/**
 * Recent platform-wide activities for the admin panel. Each row carries the
 * actor (user) + a short label (track or conversation context) so the admin
 * UI can render a feed without follow-up requests.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    before: url.searchParams.get('before') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const limit = Math.min(Math.max(parsed.data.limit ?? 100, 1), 200);
  const cursor = parsed.data.before ?? null;

  const result = await db.execute(sql`
    SELECT
      a.id          AS id,
      a.kind        AS kind,
      a.points      AS points,
      a.created_at  AS created_at,
      u.id          AS user_id,
      u.name        AS user_name,
      u.email       AS user_email,
      u.avatar_url  AS user_avatar,
      t.title       AS track_title,
      t.artist      AS track_artist,
      c.slug        AS conversation_slug
    FROM user_activities a
    JOIN users u            ON u.id = a.user_id
    LEFT JOIN tracks t      ON t.id = a.track_id
    LEFT JOIN conversations c ON c.id = a.conversation_id
    ${cursor ? sql`WHERE a.created_at < ${cursor}` : sql``}
    ORDER BY a.created_at DESC
    LIMIT ${limit + 1}
  `);

  const rows = result.rows.slice(0, limit).map((r) => ({
    id: r.id as string,
    kind: r.kind as 'stream' | 'login' | 'chat_started',
    points: r.points as number,
    // db.execute returns timestamps as ISO strings in production —
    // same coercion trap that 500'd /api/admin/users. Wrap defensively
    // so .toISOString() always sees a Date instance.
    createdAt: new Date(r.created_at as string | Date).toISOString(),
    user: {
      id: r.user_id as string,
      name: r.user_name as string | null,
      email: r.user_email as string,
      avatarUrl: r.user_avatar as string | null,
    },
    trackTitle: r.track_title as string | null,
    trackArtist: r.track_artist as string | null,
    conversationSlug: r.conversation_slug as string | null,
  }));

  return NextResponse.json({
    items: rows,
    hasMore: result.rows.length > limit,
  });
}
