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
  //
  // For brand-new accounts we seed `name` with the email's local
  // part (the segment before `@`) so the user has a sensible
  // display string from the very first time they appear in the
  // app, instead of `null` (which would force every reader to
  // fall back to email-prefix derivation client-side and risked
  // leaking the full email into greetings before the user picks
  // a real display name). Per product feedback "Para o nome, use
  // as primeiros caracteres do email". `email` is already
  // validated + lowercased by the zod schema above, so we know
  // `.split('@')[0]` is a non-empty alphanumeric local part.
  // `avatarUrl` is left at the schema's NULL default — every
  // consumer falls back to `/avatar-placeholder.svg`, no random
  // mock photos are pulled in.
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const defaultName = email.split('@')[0];
  const user =
    existing[0] ??
    (await db.insert(users).values({ email, name: defaultName }).returning())[0];

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
