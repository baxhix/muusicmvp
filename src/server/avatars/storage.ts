import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Where uploaded avatars live on disk. Mounted as a Docker volume in prod so
 * uploads survive container rebuilds.
 *
 * Override with AVATARS_DIR env var if you want to use a different path
 * (e.g., to dev locally against a non-Docker filesystem).
 */
export const AVATARS_DIR =
  process.env.AVATARS_DIR ?? path.join(process.cwd(), 'uploads', 'avatars');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type AvatarUploadError =
  | 'no_file'
  | 'unsupported_type'
  | 'too_large'
  | 'write_failed';

export interface SaveAvatarResult {
  /** Public URL the client can use (relative to APP_URL). */
  url: string;
  /** Just the filename, useful for cleanup. */
  filename: string;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(AVATARS_DIR, { recursive: true });
}

/**
 * Persist an uploaded File to disk under `<userId>.<random>.<ext>` and
 * return the relative URL to use as `users.avatar_url`.
 *
 * Throws `AvatarUploadError` (string code) on validation failures so route
 * handlers can map them to specific HTTP statuses.
 */
export async function saveAvatar(
  userId: string,
  file: File,
): Promise<SaveAvatarResult> {
  if (!file || file.size === 0) throw new Error('no_file' satisfies AvatarUploadError);

  if (file.size > MAX_BYTES) throw new Error('too_large' satisfies AvatarUploadError);

  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('unsupported_type' satisfies AvatarUploadError);
  }

  const ext = EXT_BY_MIME[file.type];
  // Random suffix so the URL changes when the avatar changes, busting browser caches.
  const filename = `${userId}.${randomBytes(6).toString('hex')}.${ext}`;

  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await fs.writeFile(path.join(AVATARS_DIR, filename), buffer);
  } catch (err) {
    console.error('avatar write failed:', err);
    throw new Error('write_failed' satisfies AvatarUploadError);
  }

  return { url: `/api/avatars/${filename}`, filename };
}

/**
 * Delete every avatar file belonging to a user (best-effort).
 * Called when the user uploads a new one or chooses "remove photo".
 */
export async function deleteUserAvatars(userId: string): Promise<void> {
  try {
    await ensureDir();
    const files = await fs.readdir(AVATARS_DIR);
    const mine = files.filter((f) => f.startsWith(`${userId}.`));
    await Promise.all(
      mine.map((f) =>
        fs.unlink(path.join(AVATARS_DIR, f)).catch(() => {
          /* ignore — file may already be gone */
        }),
      ),
    );
  } catch (err) {
    console.warn('deleteUserAvatars failed:', err);
  }
}

/** Resolve a filename to its on-disk path, validated to live under AVATARS_DIR. */
export function resolveAvatarPath(filename: string): string | null {
  // Filename is `<uuid>.<hex>.<ext>` — strict regex prevents traversal.
  if (!/^[0-9a-f-]{36}\.[0-9a-f]{8,16}\.(jpg|png|webp|gif)$/i.test(filename)) {
    return null;
  }
  return path.join(AVATARS_DIR, filename);
}

/** Content-Type baseado na extensão. Re-export do central pra
 *  manter API existente das rotas; lógica única em `storage/mime.ts`. */
export { getContentType as contentTypeOf } from '../storage/mime';
