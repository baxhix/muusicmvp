import { cookies } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { db } from '../db';
import { tokens, users, type User } from '../db/schema';
import { hashToken, SESSION_TTL_MS, generateToken } from './tokens';

export const SESSION_COOKIE = 'muusic_session';

/** Create a session token row and set the httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(tokens).values({
    tokenHash: hash,
    userId,
    kind: 'session',
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** Read the session cookie and return the current user, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const hash = hashToken(raw);
  const rows = await db
    .select({ user: users })
    .from(tokens)
    .innerJoin(users, eq(users.id, tokens.userId))
    .where(
      and(
        eq(tokens.tokenHash, hash),
        eq(tokens.kind, 'session'),
        gt(tokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return rows[0]?.user ?? null;
}

/** Delete the cookie and the corresponding token row. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (raw) {
    await db.delete(tokens).where(eq(tokens.tokenHash, hashToken(raw)));
  }
  cookieStore.delete(SESSION_COOKIE);
}
