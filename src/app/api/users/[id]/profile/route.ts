import { NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { requireUser } from '@/server/auth/requireUser';
import { publicFirstName } from '@/server/users/serialize';
import { env } from '@/server/env';

export const runtime = 'nodejs';

const ONLINE_WINDOW_MS = 60_000;

/**
 * Same coercion the admin queries use — relative `/uploads/...` paths
 * get rewritten to absolute URLs so cross-subdomain consumers can load
 * uploaded avatars.
 */
function absoluteAvatar(raw: string | null): string | null {
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) return raw;
  if (raw.startsWith('/')) return env.APP_URL ? `${env.APP_URL}${raw}` : raw;
  return raw;
}

/**
 * Public user profile endpoint. Returns the identity + engagement
 * aggregates the muusic ProfilePanel needs to render any user
 * (own or someone else's). The shape stays narrow: no email leak
 * unless it's the caller themselves looking at their own row.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  const caller = auth;

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  // Identity row.
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      city: users.city,
      country: users.country,
      countryCode: users.countryCode,
      locationConsent: users.locationConsent,
      isMinor: users.isMinor,
      avatarUrl: users.avatarUrl,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  const u = rows[0];
  if (!u) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Engagement aggregates + now playing in a single round trip.
  // IMPORTANTE: fanpoints/streams vêm de SUBQUERIES escalares, NÃO de um
  // JOIN com user_activities. Antes a query fazia
  //   LEFT JOIN user_activities a + LEFT JOIN now_playing np + GROUP BY
  // e, quando o user tinha mais de uma linha em now_playing, o join
  // "fanava" as linhas de atividade e o SUM(a.points) DOBRAVA (bug do
  // "mostra o dobro de pontos"). Isolando a agregação em subqueries, o
  // saldo fica correto independente de quantas linhas de now_playing
  // existam. O join de now_playing fica só pra faixa atual (LIMIT 1).
  const result = await db.execute(sql`
    SELECT
      COALESCE((SELECT SUM(points) FROM user_activities WHERE user_id = u.id), 0)::int                       AS fanpoints,
      COALESCE((SELECT COUNT(*) FROM user_activities WHERE user_id = u.id AND kind = 'stream'), 0)::int       AS streams,
      np.track_id   AS np_track_id,
      t.title       AS np_title,
      t.artist      AS np_artist,
      t.youtube_id  AS np_youtube_id
    FROM users u
    LEFT JOIN now_playing np    ON np.user_id = u.id
    LEFT JOIN tracks t          ON t.id = np.track_id
    WHERE u.id = ${id}
    LIMIT 1
  `);
  const agg = (result.rows[0] ?? {}) as {
    fanpoints?: number;
    streams?: number;
    np_track_id?: string | null;
    np_title?: string | null;
    np_artist?: string | null;
    np_youtube_id?: string | null;
  };

  const onlineSince = Date.now() - ONLINE_WINDOW_MS;
  const lastSeenMs = u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0;
  const isSelf = u.id === caller.id;
  // Localização aproximada só pra self ou pra quem consentiu compartilhar (LGPD).
  const showLocation = isSelf || u.locationConsent;

  return NextResponse.json({
    user: {
      id: u.id,
      // Proteção a menores: pra OUTRA pessoa, só o primeiro nome do
      // menor aparece (oculta sobrenome completo). Self vê o nome cheio.
      name: isSelf ? u.name : publicFirstName(u.name, Boolean(u.isMinor)),
      // Hide email on cross-user lookups; only return it for self.
      email: isSelf ? u.email : null,
      city: showLocation ? u.city : null,
      country: showLocation ? u.country : null,
      countryCode: showLocation ? u.countryCode : null,
      avatarUrl: absoluteAvatar(u.avatarUrl),
      fanpoints: agg.fanpoints ?? 0,
      streams: agg.streams ?? 0,
      isOnline: lastSeenMs >= onlineSince,
      nowPlaying:
        agg.np_track_id && agg.np_title
          ? {
              trackId: agg.np_track_id,
              title: agg.np_title,
              artist: agg.np_artist ?? '',
              youtubeId: agg.np_youtube_id ?? null,
            }
          : null,
    },
  });
}
