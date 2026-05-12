import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { users, tokens } from '@/server/db/schema';
import { generateToken, MAGIC_TTL_MS } from '@/server/auth/tokens';
import { sendMagicLink } from '@/server/email/magicLink';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

/**
 * Allowlist for the optional `returnTo` field: only same-suffix
 * subdomains of muusic.live are accepted. localhost is allowed for
 * dev. Anything else is silently dropped — the magic link still
 * works, it just falls back to the default verify→/app redirect.
 */
function sanitizeReturnTo(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    if (u.hostname === 'muusic.live' || u.hostname.endsWith('.muusic.live')) return u.toString();
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return u.toString();
    return undefined;
  } catch {
    return undefined;
  }
}

const bodySchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  returnTo: z.string().url().optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { email } = parsed;
  const returnTo = sanitizeReturnTo(parsed.returnTo);

  // Upsert: create user if first sign-in, otherwise reuse.
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user =
    existing[0] ??
    (await db.insert(users).values({ email }).returning())[0];

  const { raw, hash } = generateToken();
  await db.insert(tokens).values({
    tokenHash: hash,
    userId: user.id,
    kind: 'magic',
    expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
  });

  try {
    await sendMagicLink(email, raw, returnTo);
  } catch (err) {
    console.error('magic-link send failed:', err);
    return NextResponse.json({ error: 'email_failed' }, { status: 502 });
  }

  // Don't reveal whether the user already existed.
  return NextResponse.json({ ok: true });
}
