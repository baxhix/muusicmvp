import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { logger } from '../log';

/**
 * Where uploaded group avatars live on disk. Mounted as a Docker
 * volume in prod so files survive container rebuilds. Kept separate
 * from AVATARS_DIR / REPORTS_DIR so each storage can be backed up /
 * rotated / pruned independently.
 *
 * Override via GROUPS_DIR env var when running locally.
 */
export const GROUPS_DIR =
  process.env.GROUPS_DIR ?? path.join(process.cwd(), 'uploads', 'groups');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — same ceiling as user avatars

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type GroupImageError =
  | 'no_file'
  | 'unsupported_type'
  | 'too_large'
  | 'write_failed';

export interface SaveGroupImageResult {
  /** Public URL to load the image from (served by the static route). */
  url: string;
  /** Bare filename — useful for cleanup if the group is deleted. */
  filename: string;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(GROUPS_DIR, { recursive: true });
}

/**
 * Persist a group avatar to disk under
 *   <conversationId>.<random>.<ext>
 * and return the public URL. Same validation rules as user avatars
 * (jpeg/png/webp/gif, ≤2 MB).
 */
export async function saveGroupImage(
  conversationId: string,
  file: File,
): Promise<SaveGroupImageResult> {
  if (!file || file.size === 0) throw new Error('no_file' satisfies GroupImageError);
  if (file.size > MAX_BYTES) throw new Error('too_large' satisfies GroupImageError);
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('unsupported_type' satisfies GroupImageError);
  }

  const ext = EXT_BY_MIME[file.type];
  const filename = `${conversationId}.${randomBytes(6).toString('hex')}.${ext}`;

  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await fs.writeFile(path.join(GROUPS_DIR, filename), buffer);
  } catch (err) {
    logger.error('groups.image.write', err);
    throw new Error('write_failed' satisfies GroupImageError);
  }

  return { url: `/api/groups/images/${filename}`, filename };
}

/** Resolve a filename to its on-disk path, validated to live under
 *  GROUPS_DIR. Returns null if the filename doesn't match the strict
 *  shape we generate (prevents path traversal). */
export function resolveGroupImagePath(filename: string): string | null {
  if (!/^[0-9a-f-]{36}\.[0-9a-f]{8,16}\.(jpg|png|webp|gif)$/i.test(filename)) {
    return null;
  }
  return path.join(GROUPS_DIR, filename);
}

/** Content-Type baseado na extensão. Re-export do central pra
 *  manter API existente das rotas; lógica única em `storage/mime.ts`. */
export { getContentType as contentTypeOf } from '../storage/mime';

/** Best-effort cleanup of all images stored for a group (called when
 *  the group is hard-deleted). Same shape as deleteUserAvatars. */
export async function deleteGroupImages(conversationId: string): Promise<void> {
  try {
    await ensureDir();
    const files = await fs.readdir(GROUPS_DIR);
    const mine = files.filter((f) => f.startsWith(`${conversationId}.`));
    await Promise.all(
      mine.map((f) =>
        fs.unlink(path.join(GROUPS_DIR, f)).catch(() => {
          /* ignore — file may already be gone */
        }),
      ),
    );
  } catch (err) {
    console.warn('deleteGroupImages failed:', err);
  }
}
