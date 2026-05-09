import crypto from 'node:crypto';

export const MAGIC_TTL_MS = 15 * 60 * 1000;        // 15 minutes
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Generate a fresh random token. Returns the raw value (sent to user) and its sha256 hash (stored in DB). */
export function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url');
  const hash = hashToken(raw);
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
