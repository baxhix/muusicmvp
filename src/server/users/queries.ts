import { and, desc, eq, gt, ilike, ne, or } from 'drizzle-orm';
import { db } from '../db';
import { nowPlaying, tracks, users } from '../db/schema';

const ONLINE_WINDOW_MS = 60_000; // last_seen_at within 60s = online

/**
 * List users currently online (last_seen_at within the online window),
 * with their public profile + what they're playing right now (if any).
 * Excludes the requesting user.
 */
export async function listOnlineUsers(excludeUserId: string, limit = 200) {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      city: users.city,
      country: users.country,
      lat: users.lat,
      lng: users.lng,
      lastSeenAt: users.lastSeenAt,
      trackTitle: tracks.title,
      trackArtist: tracks.artist,
      trackYoutubeId: tracks.youtubeId,
    })
    .from(users)
    .leftJoin(nowPlaying, eq(nowPlaying.userId, users.id))
    .leftJoin(tracks, eq(tracks.id, nowPlaying.trackId))
    .where(
      and(
        ne(users.id, excludeUserId),
        gt(users.lastSeenAt, since),
      ),
    )
    .orderBy(desc(users.lastSeenAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    avatarUrl: r.avatarUrl,
    city: r.city,
    country: r.country,
    lat: r.lat,
    lng: r.lng,
    nowPlaying: r.trackTitle
      ? {
          title: r.trackTitle,
          artist: r.trackArtist,
          youtubeId: r.trackYoutubeId,
        }
      : null,
  }));
}

/** Search users by name or email prefix (for starting DMs). */
export async function searchUsers(
  query: string,
  excludeUserId: string,
  limit = 20,
) {
  const q = query.trim();
  if (q.length < 2) return [];

  const like = `${q}%`;

  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      city: users.city,
    })
    .from(users)
    .where(
      and(
        ne(users.id, excludeUserId),
        or(ilike(users.name, like), ilike(users.email, like)),
      ),
    )
    .orderBy(users.name)
    .limit(limit);
}

/** Update the current user's profile fields (name, avatarUrl). */
export async function updateProfile(
  userId: string,
  patch: { name?: string; avatarUrl?: string },
) {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.avatarUrl !== undefined) updates.avatarUrl = patch.avatarUrl;
  if (Object.keys(updates).length === 0) return;

  await db.update(users).set(updates).where(eq(users.id, userId));
}

/** Touch last_seen_at on a user. Called by the realtime presence handler. */
export async function touchLastSeen(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ lastSeenAt: new Date() })
    .where(eq(users.id, userId));
}

