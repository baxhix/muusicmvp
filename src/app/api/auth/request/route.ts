import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { users, tokens } from '@/server/db/schema';
import { generateToken, MAGIC_TTL_MS } from '@/server/auth/tokens';
import { sendMagicLink } from '@/server/email/magicLink';
import { eq } from 'drizzle-orm';

export const runtime = 'nodejs';

const bodySchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { email } = parsed;

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
    await sendMagicLink(email, raw);
  } catch (err) {
    console.error('magic-link send failed:', err);
    return NextResponse.json({ error: 'email_failed' }, { status: 502 });
  }

  // Don't reveal whether the user already existed.
  return NextResponse.json({ ok: true });
}
