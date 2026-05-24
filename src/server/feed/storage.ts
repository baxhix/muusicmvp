import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { logger } from '../log';

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

// Videos live under the same `uploads/feed/` volume but with their
// own MIME whitelist + much bigger size cap. Modern phones produce
// 4K clips that blow past 50 MB even with 10s of recording, so the
// ceiling is 100 MB. The two whitelists DON'T overlap, so the
// route-level helper can pick which one to apply.
const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/ogg',
]);
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

const VIDEO_EXT_BY_MIME: Record<string, string> = {
  'video/mp4':         'mp4',
  'video/webm':        'webm',
  'video/quicktime':   'mov',
  'video/ogg':         'ogv',
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
    logger.error('feed.image.write', err);
    throw new Error('write_failed' satisfies FeedUploadError);
  }

  return { url: `/api/feed/images/${filename}`, filename };
}

/**
 * Same shape as `saveFeedImage` but for video files. Lives under
 * the same uploads/feed/ directory and is served by a sibling
 * /api/feed/videos/[filename] route. Keeping the two helpers
 * separate (instead of overloading saveFeedImage) means each one
 * can evolve its own validation rules without surprising callers.
 */
export async function saveFeedVideo(
  ownerId: string,
  file: File,
): Promise<SaveFeedImageResult> {
  if (!file || file.size === 0) {
    throw new Error('no_file' satisfies FeedUploadError);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('too_large' satisfies FeedUploadError);
  }
  if (!ALLOWED_VIDEO_MIME.has(file.type)) {
    throw new Error('unsupported_type' satisfies FeedUploadError);
  }

  const ext = VIDEO_EXT_BY_MIME[file.type];
  const filename = `${ownerId}.${randomBytes(8).toString('hex')}.${ext}`;

  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await fs.writeFile(path.join(FEED_DIR, filename), buffer);
  } catch (err) {
    logger.error('feed.video.write', err);
    throw new Error('write_failed' satisfies FeedUploadError);
  }

  return { url: `/api/feed/videos/${filename}`, filename };
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

/** Same as resolveFeedImagePath but for the video file extensions. */
export function resolveFeedVideoPath(filename: string): string | null {
  if (!/^[0-9a-f-]{36}\.[0-9a-f]{8,16}\.(mp4|webm|mov|ogv)$/i.test(filename)) {
    return null;
  }
  return path.join(FEED_DIR, filename);
}

/** Content-Type baseado na extensão. Re-export do central pra
 *  manter API existente das rotas; lógica única em `storage/mime.ts`. */
export { getContentType as contentTypeOf } from '../storage/mime';
