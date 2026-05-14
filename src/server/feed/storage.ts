import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Storage helper for admin-uploaded feed images.
 *
 * Same pattern as `src/server/avatars/storage.ts`:
 *   - Files live under a Docker volume (`FEED_DIR=/app/uploads/feed`)
 *     so uploads survive container rebuilds.
 *   - Filenames are `<uuid>.<random>.<ext>`; the random suffix makes
 *     the URL immutable per upload → safe to cache aggressively.
 *   - Served by a public Next.js route that validates the filename
 *     against a strict regex (no path traversal).
 *
 * Capacity:
 *   - 8 MB per image (feed posts get squashed for the player but the
 *     admin upload accepts the originals — frontend can compress
 *     later without a server change).
 *   - jpg / png / webp / gif. AVIF intentionally omitted until we
 *     measure browser support across the audience.
 */
export const FEED_DIR =
  process.env.FEED_DIR ?? path.join(process.cwd(), 'uploads', 'feed');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type FeedUploadError =
  | 'no_file'
  | 'unsupported_type'
  | 'too_large'
  | 'write_failed';

export interface SaveFeedImageResult {
  url: string;
  filename: string;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(FEED_DIR, { recursive: true });
}

/**
 * Persist an uploaded File. Returns the relative URL the admin UI
 * can stash in `feed_posts.media`. `ownerId` (the admin user id)
 * prefixes the filename so we can later wipe a single admin's
 * uploads without scanning every row.
 */
export async function saveFeedImage(
  ownerId: string,
  file: File,
): Promise<SaveFeedImageResult> {
  if (!file || file.size === 0) {
    throw new Error('no_file' satisfies FeedUploadError);
  }
  if (file.size > MAX_BYTES) {
    throw new Error('too_large' satisfies FeedUploadError);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('unsupported_type' satisfies FeedUploadError);
  }

  const ext = EXT_BY_MIME[file.type];
  const filename = `${ownerId}.${randomBytes(8).toString('hex')}.${ext}`;

  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await fs.writeFile(path.join(FEED_DIR, filename), buffer);
  } catch (err) {
    console.error('feed image write failed:', err);
    throw new Error('write_failed' satisfies FeedUploadError);
  }

  return { url: `/api/feed/images/${filename}`, filename };
}

/** Delete a single uploaded image by filename (best-effort). */
export async function deleteFeedImage(filename: string): Promise<void> {
  const p = resolveFeedImagePath(filename);
  if (!p) return;
  try {
    await fs.unlink(p);
  } catch {
    /* already gone — ignore */
  }
}

/** Resolve a filename to its on-disk path, validated against traversal. */
export function resolveFeedImagePath(filename: string): string | null {
  if (!/^[0-9a-f-]{36}\.[0-9a-f]{8,16}\.(jpg|png|webp|gif)$/i.test(filename)) {
    return null;
  }
  return path.join(FEED_DIR, filename);
}

export function contentTypeOf(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}
