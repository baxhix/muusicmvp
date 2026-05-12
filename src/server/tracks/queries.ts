import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { tracks, type Track } from '../db/schema';

/**
 * Catalog shape consumed by the in-app player (NowPlaying, PlaylistModal).
 * Mirrors data/tracksCatalog.CatalogTrack so the hook fallback stays
 * interchangeable.
 */
export interface CatalogTrack {
  title: string;
  artist: string;
  album?: string;
  year: number;
  youtubeId: string;
}

/**
 * Admin-facing shape — same fields + the DB id and createdAt so the
 * management table can target deletes and order by recency.
 */
export interface AdminTrackRow extends CatalogTrack {
  id: string;
  createdAt: string;
}

/**
 * All tracks in the canonical order the player should walk through.
 * Newest first so admin additions surface immediately at the top —
 * existing seeded tracks naturally drift to the tail.
 */
export async function listAllTracks(): Promise<CatalogTrack[]> {
  const rows = await db
    .select({
      title: tracks.title,
      artist: tracks.artist,
      album: tracks.album,
      youtubeId: tracks.youtubeId,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .orderBy(desc(tracks.createdAt));
  return rows.map((r) => ({
    title: r.title,
    artist: r.artist,
    album: r.album ?? undefined,
    // No `year` column yet — derive from createdAt as a sensible
    // default so the player's "year" field stays populated.
    year: new Date(r.createdAt).getFullYear(),
    youtubeId: r.youtubeId,
  }));
}

/** Admin listing — adds id + createdAt for table management. */
export async function listAllTracksForAdmin(): Promise<AdminTrackRow[]> {
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      artist: tracks.artist,
      album: tracks.album,
      youtubeId: tracks.youtubeId,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .orderBy(desc(tracks.createdAt));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    album: r.album ?? undefined,
    year: new Date(r.createdAt).getFullYear(),
    youtubeId: r.youtubeId,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

/**
 * Insert a track. Idempotent on youtubeId — returns the existing row
 * when a duplicate is detected, so the admin form can swallow the
 * conflict gracefully instead of bubbling up an HTTP 500.
 */
export async function createTrack(input: {
  title: string;
  artist: string;
  youtubeId: string;
  album?: string | null;
}): Promise<{ row: Track; created: boolean }> {
  const existing = await db
    .select()
    .from(tracks)
    .where(eq(tracks.youtubeId, input.youtubeId))
    .limit(1);
  if (existing[0]) return { row: existing[0], created: false };

  const inserted = await db
    .insert(tracks)
    .values({
      title: input.title,
      artist: input.artist,
      album: input.album ?? null,
      youtubeId: input.youtubeId,
    })
    .returning();
  return { row: inserted[0], created: true };
}

/** Delete a single track. Cascades to listening_history via fk. */
export async function deleteTrack(id: string): Promise<boolean> {
  const deleted = await db
    .delete(tracks)
    .where(eq(tracks.id, id))
    .returning({ id: tracks.id });
  return deleted.length > 0;
}

/* ── YouTube URL helpers ─────────────────────────────────────── */

/**
 * Extract a YouTube video id from the assortment of URL shapes the
 * service accepts. Supports:
 *
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/shorts/ID
 *   - https://music.youtube.com/watch?v=ID
 *   - https://m.youtube.com/watch?v=ID
 *   - https://youtube.com/embed/ID
 *   - Bare 11-char id (e.g. "dQw4w9WgXcQ")
 *
 * Returns null on anything else — the route handler maps that to an
 * HTTP 400 with a clear error message.
 */
export function extractYouTubeId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Bare 11-character ID — alphanumeric + dash + underscore.
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`,
    );
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  }

  // youtube.com / music.youtube.com / m.youtube.com (and any sub).
  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    // /watch?v=<id>
    const v = url.searchParams.get('v');
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
    // /shorts/<id>  or  /embed/<id>  or  /v/<id>
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['shorts', 'embed', 'v'].includes(parts[0])) {
      const id = parts[1];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return id;
    }
  }

  return null;
}
