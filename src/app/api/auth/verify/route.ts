import { NextResponse } from 'next/server';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { tokens } from '@/server/db/schema';
import { hashToken } from '@/server/auth/tokens';
import { createSession } from '@/server/auth/session';
import { env } from '@/server/env';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get('token');
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

  return NextResponse.redirect(new URL('/app', env.APP_URL));
}
