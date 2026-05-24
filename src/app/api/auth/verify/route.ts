import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/server/db';
import { tokens, users } from '@/server/db/schema';
import { hashToken } from '@/server/auth/tokens';
import { createSession } from '@/server/auth/session';
import { env } from '@/server/env';
import { limitByIp, verifyLimiter } from '@/server/rateLimit';

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

/**
 * GET: chamado pelo magic link no email. Consome o token via hash
 * e cria sessão. Redireciona pra /app (ou returnTo).
 */
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

  await db
    .update(tokens)
    .set({ consumedAt: new Date() })
    .where(eq(tokens.tokenHash, hash));

  await createSession(magic.userId);

  return NextResponse.redirect(returnTo ?? new URL('/app', env.APP_URL));
}

/**
 * POST: chamado pelo /auth/verify quando o usuário digita o
 * código de 6 dígitos como FALLBACK ao magic link.
 *
 * Body: { email, code }. Procura o token magic ativo da conta
 * com esse email + code, valida expiração + single-use, cria
 * sessão. Retorna JSON (não redirect) pra que o frontend
 * controle a navegação após o success.
 */
const postBodySchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  code: z.string().regex(/^\d{6}$/),
});

export async function POST(req: Request) {
  /* Rate limit por IP — protege contra brute-force do OTP de 6
   *  dígitos. 10 burst + 3/min sustentado. Acima disso o
   *  atacante teria que esperar entre tentativas. */
  const rl = limitByIp(req, verifyLimiter, 'auth.verify');
  if (!rl.ok) return rl.response;

  let parsed;
  try {
    parsed = postBodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { email, code } = parsed;

  // Resolve user pelo email primeiro (o token é vinculado por
  // userId, não email diretamente).
  const userRow = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!userRow[0]) {
    // Não revela se o email existe — generic error.
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const row = await db
    .select()
    .from(tokens)
    .where(
      and(
        eq(tokens.userId, userRow[0].id),
        eq(tokens.kind, 'magic'),
        eq(tokens.code, code),
        gt(tokens.expiresAt, new Date()),
        isNull(tokens.consumedAt),
      ),
    )
    .limit(1);

  const magic = row[0];
  if (!magic) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  // Marca consumido pelo hash do token (PK).
  await db
    .update(tokens)
    .set({ consumedAt: new Date() })
    .where(eq(tokens.tokenHash, magic.tokenHash));

  await createSession(magic.userId);

  return NextResponse.json({ ok: true });
}
