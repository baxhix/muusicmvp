import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { logger } from '../log';

/**
 * Where uploaded report-evidence images live on disk. Mounted as a
 * Docker volume in prod so they survive container rebuilds. Kept
 * separate from `AVATARS_DIR` so the two storages can be backed up
 * / rotated / pruned independently.
 *
 * Override via REPORTS_DIR env var when running locally.
 */
export const REPORTS_DIR =
  process.env.REPORTS_DIR ?? path.join(process.cwd(), 'uploads', 'reports');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — slightly bigger than avatars
                                    // since evidence screenshots tend to
                                    // be larger than profile photos.

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type ReportImageError =
  | 'no_file'
  | 'unsupported_type'
  | 'too_large'
  | 'write_failed';

export interface SaveReportImageResult {
  /** Public URL the admin can use to load the image. */
  url: string;
  /** Bare filename for cleanup if the parent report is deleted. */
  filename: string;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

/**
 * Persist an evidence image to disk under
 *   <reportId>.<random>.<ext>
 * and return the public URL. Same validation rules as avatars
 * (jpeg/png/webp/gif, capped size).
 */
export async function saveReportImage(
  reportId: string,
  file: File,
): Promise<SaveReportImageResult> {
  if (!file || file.size === 0) throw new Error('no_file' satisfies ReportImageError);
  if (file.size > MAX_BYTES) throw new Error('too_large' satisfies ReportImageError);
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error('unsupported_type' satisfies ReportImageError);
  }

  const ext = EXT_BY_MIME[file.type];
  const filename = `${reportId}.${randomBytes(6).toString('hex')}.${ext}`;

  await ensureDir();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    await fs.writeFile(path.join(REPORTS_DIR, filename), buffer);
  } catch (err) {
    logger.error('reports.image.write', err);
    throw new Error('write_failed' satisfies ReportImageError);
  }

  return { url: `/api/reports/images/${filename}`, filename };
}

/** Resolve a filename to its on-disk path, validated to live under
 *  REPORTS_DIR. Returns null if the filename doesn't match the strict
 *  shape we generate (prevents path traversal). */
export function resolveReportImagePath(filename: string): string | null {
  if (!/^[0-9a-f-]{36}\.[0-9a-f]{8,16}\.(jpg|png|webp|gif)$/i.test(filename)) {
    return null;
  }
  return path.join(REPORTS_DIR, filename);
}

/** Content-Type baseado na extensão. Re-export do central pra
 *  manter API existente das rotas; lógica única em `storage/mime.ts`. */
export { getContentType as contentTypeOf } from '../storage/mime';
