import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { tracks, trackLikes, trackComments, users } from '../db/schema';
import { TRACKS_CATALOG } from '@/data/tracksCatalog';
import { publicFirstName } from '../users/serialize';

/**
 * Social de faixa — comentários + likes por música. Tudo é endereçado
 * pelo `youtubeId` (a chave estável que o cliente conhece); a row em
 * `tracks` é resolvida/criada lazy a partir do catálogo (TRACKS_CATALOG),
 * espelhando o padrão do `getOrCreateFeedPost`. Likes reusam `trackLikes`.
 */

export interface TrackCommentRow {
  id: string;
  body: string;
  createdAt: string; // ISO
  author: { id: string; name: string | null; avatarUrl: string | null };
  isMine: boolean;
}

export interface TrackSocial {
  likeCount: number;
  likedByMe: boolean;
  commentCount: number;
}

/** Resolve (ou cria) o uuid da track pelo youtubeId. null se desconhecido. */
export async function getOrCreateTrackId(youtubeId: string): Promise<string | null> {
  const existing = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.youtubeId, youtubeId))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const meta = TRACKS_CATALOG.find((t) => t.youtubeId === youtubeId);
  if (!meta) return null; // youtubeId fora do catálogo — não cria lixo

  await db
    .insert(tracks)
    .values({
      title: meta.title,
      artist: meta.artist,
      album: meta.album ?? null,
      youtubeId,
    })
    .onConflictDoNothing({ target: tracks.youtubeId });

  const row = await db
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.youtubeId, youtubeId))
    .limit(1);
  return row[0]?.id ?? null;
}

export async function getTrackSocial(
  trackId: string,
  viewerId: string,
): Promise<TrackSocial> {
  const [likeAgg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trackLikes)
    .where(eq(trackLikes.trackId, trackId));
  const [mine] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trackLikes)
    .where(
      and(eq(trackLikes.trackId, trackId), eq(trackLikes.userId, viewerId)),
    );
  const [cAgg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trackComments)
    .where(
      and(
        eq(trackComments.trackId, trackId),
        sql`${trackComments.deletedAt} is null`,
      ),
    );
  return {
    likeCount: likeAgg?.n ?? 0,
    likedByMe: (mine?.n ?? 0) > 0,
    commentCount: cAgg?.n ?? 0,
  };
}

export async function toggleTrackLike(
  trackId: string,
  userId: string,
): Promise<{ liked: boolean; likeCount: number }> {
  const existing = await db
    .select({ userId: trackLikes.userId })
    .from(trackLikes)
    .where(and(eq(trackLikes.trackId, trackId), eq(trackLikes.userId, userId)))
    .limit(1);
  if (existing[0]) {
    await db
      .delete(trackLikes)
      .where(
        and(eq(trackLikes.trackId, trackId), eq(trackLikes.userId, userId)),
      );
  } else {
    await db.insert(trackLikes).values({ userId, trackId }).onConflictDoNothing();
  }
  const [agg] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trackLikes)
    .where(eq(trackLikes.trackId, trackId));
  return { liked: !existing[0], likeCount: agg?.n ?? 0 };
}

export async function listTrackComments(args: {
  trackId: string;
  viewerId: string;
  before?: Date | null;
  limit?: number;
}): Promise<{ comments: TrackCommentRow[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(args.limit ?? 30, 1), 50);
  const rows = await db
    .select({
      id: trackComments.id,
      body: trackComments.body,
      createdAt: trackComments.createdAt,
      authorId: trackComments.authorId,
      authorName: users.name,
      authorIsMinor: users.isMinor,
      authorAvatar: users.avatarUrl,
    })
    .from(trackComments)
    .leftJoin(users, eq(users.id, trackComments.authorId))
    .where(
      and(
        eq(trackComments.trackId, args.trackId),
        sql`${trackComments.deletedAt} is null`,
        args.before ? lt(trackComments.createdAt, args.before) : undefined,
      ),
    )
    .orderBy(desc(trackComments.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  return {
    comments: rows.slice(0, limit).map((r) => ({
      id: r.id,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
      // Proteção a menores: só primeiro nome pra menores (listagem pública).
      author: {
        id: r.authorId,
        name: publicFirstName(r.authorName, Boolean(r.authorIsMinor)),
        avatarUrl: r.authorAvatar,
      },
      isMine: r.authorId === args.viewerId,
    })),
    hasMore,
  };
}

export async function createTrackComment(args: {
  trackId: string;
  authorId: string;
  body: string;
}): Promise<TrackCommentRow> {
  const body = args.body.trim().slice(0, 2000);
  const [inserted] = await db
    .insert(trackComments)
    .values({ trackId: args.trackId, authorId: args.authorId, body })
    .returning({ id: trackComments.id, createdAt: trackComments.createdAt });
  const [author] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, args.authorId))
    .limit(1);
  return {
    id: inserted.id,
    body,
    createdAt: inserted.createdAt.toISOString(),
    author: {
      id: args.authorId,
      name: author?.name ?? null,
      avatarUrl: author?.avatarUrl ?? null,
    },
    isMine: true,
  };
}

/** Soft-delete — só o autor. Retorna true se apagou. */
export async function deleteTrackComment(
  commentId: string,
  callerId: string,
): Promise<boolean> {
  const res = await db
    .update(trackComments)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(trackComments.id, commentId),
        eq(trackComments.authorId, callerId),
        sql`${trackComments.deletedAt} is null`,
      ),
    )
    .returning({ id: trackComments.id });
  return res.length > 0;
}

/**
 * Social de VÁRIAS faixas de uma vez (likeCount/likedByMe/commentCount),
 * endereçadas por youtubeId. Uma só ida ao banco por métrica — usado
 * pela PlaylistModal pra pintar os contadores de cada row sem N
 * requests. Faixas sem row em `tracks` (nunca tocadas/curtidas) saem
 * com tudo zerado. NÃO cria rows (read-only).
 */
export async function getTracksSocialBatch(
  youtubeIds: string[],
  viewerId: string,
): Promise<Record<string, TrackSocial>> {
  const out: Record<string, TrackSocial> = {};
  for (const yt of youtubeIds) {
    out[yt] = { likeCount: 0, likedByMe: false, commentCount: 0 };
  }
  if (youtubeIds.length === 0) return out;

  const trackRows = await db
    .select({ id: tracks.id, youtubeId: tracks.youtubeId })
    .from(tracks)
    .where(inArray(tracks.youtubeId, youtubeIds));
  if (trackRows.length === 0) return out;

  const idToYt = new Map(trackRows.map((r) => [r.id, r.youtubeId]));
  const trackIds = trackRows.map((r) => r.id);

  const [likeCounts, mine, commentCounts] = await Promise.all([
    db
      .select({ trackId: trackLikes.trackId, n: sql<number>`count(*)::int` })
      .from(trackLikes)
      .where(inArray(trackLikes.trackId, trackIds))
      .groupBy(trackLikes.trackId),
    db
      .select({ trackId: trackLikes.trackId })
      .from(trackLikes)
      .where(
        and(inArray(trackLikes.trackId, trackIds), eq(trackLikes.userId, viewerId)),
      ),
    db
      .select({ trackId: trackComments.trackId, n: sql<number>`count(*)::int` })
      .from(trackComments)
      .where(
        and(
          inArray(trackComments.trackId, trackIds),
          sql`${trackComments.deletedAt} is null`,
        ),
      )
      .groupBy(trackComments.trackId),
  ]);

  for (const r of likeCounts) {
    const yt = idToYt.get(r.trackId);
    if (yt) out[yt].likeCount = r.n;
  }
  for (const r of mine) {
    const yt = idToYt.get(r.trackId);
    if (yt) out[yt].likedByMe = true;
  }
  for (const r of commentCounts) {
    const yt = idToYt.get(r.trackId);
    if (yt) out[yt].commentCount = r.n;
  }
  return out;
}
