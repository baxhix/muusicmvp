import { NextResponse } from 'next/server';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { tokens } from '@/server/db/schema';
import { hashToken } from '@/server/auth/tokens';
import { createSession } from '@/server/auth/session';
import { env } from '@/server/env';

export const runtime = 'nodejs';

/**
 * Re-validates the optional `returnTo` query param here, even though
 * /api/auth/request already sanitized it — defense in depth against
 * tampered links. Allowlist matches: muusic.live + any *.muusic.live
 * subdomain, plus localhost for dev.
 */
function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.hostname === 'muusic.live' || u.hostname.endsWith('.muusic.live')) return u.toString();
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return u.toString();
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('token');
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  if (!raw) {
    return NextResponse.redirect(new URL('/?auth=invalid', env.APP_URL));
  }

  const hash = hashToken(raw);

  const row = await db
    .select()
    .from(tokens)
    .where(
      and(
        eq(tokens.tokenHash, hash),
        eq(tokens.kind, 'magic'),
        gt(tokens.expiresAt, new Date()),
        isNull(tokens.consumedAt),
      ),
    )
    .limit(1);

  const magic = row[0];
  if (!magic) {
    return NextResponse.redirect(new URL('/?auth=expired', env.APP_URL));
  }

  // Mark consumed and create a session in a single round-trip is fine for MVP.
  await db
    .update(tokens)
    .set({ consumedAt: new Date() })
    .where(eq(tokens.tokenHash, hash));

  await createSession(magic.userId);

  // If the magic link carried a returnTo (admin.muusic.live, etc.),
  // land the user back where they started. The session cookie is
  // scoped to .muusic.live so every subdomain sees it. Falls back to
  // /app on muusic.live for the default flow.
  return NextResponse.redirect(returnTo ?? new URL('/app', env.APP_URL));
}
