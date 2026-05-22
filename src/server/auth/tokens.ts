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

/**
 * Generate a 6-digit OTP code as fallback for magic-link.
 * Enviado no mesmo email que o link — o usuário pode clicar
 * no link OU digitar o código no /auth/verify.
 *
 * Entropy: 6 dígitos = 1M combinações. Não é forte sozinho
 * (10^6 brute-force viável em minutos), então:
 *   - TTL curto (15min, mesmo do magic link)
 *   - Rate limit em /api/auth/verify (TODO no MVP)
 *   - Single-use: consumed_at marcado após primeiro uso
 */
export function generateCode(): string {
  // randomInt é uniform e cryptographically secure.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}
