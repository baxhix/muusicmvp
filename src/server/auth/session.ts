import { cookies } from 'next/headers';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db';
import { tokens, users, type User } from '../db/schema';
import { env } from '../env';
import { logger } from '../log';
import { hashToken, SESSION_TTL_MS, generateToken } from './tokens';
import { recordActivity } from '../activities/queries';

export const SESSION_COOKIE = 'muusic_session';

/** Sets the session cookie. Compartilhado entre createSession e
 *  consumeMagicAndCreateSession pra evitar drift de config. */
async function setSessionCookie(raw: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    // When set (prod), shares the cookie with subdomains (e.g. admin.*).
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}

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

  await setSessionCookie(raw, expiresAt);

  // Each magic-link verification counts as a login activity. Fire and
  // forget so an audit-log failure doesn't break sign-in.
  void recordActivity(userId, 'login');
}

/**
 * Atomicamente marca o magic token como consumido E cria o session
 * token, dentro de uma transação. Antes era 2 awaits separados:
 * se o INSERT da session falhasse após o UPDATE do magic,
 * o usuário ficava com magic já consumido mas sem session —
 * próxima tentativa via link viria como "expired". Pior: usuário
 * achava que o login funcionou (a request 200 OK) mas no próximo
 * page-load o cookie não existia.
 *
 * Agora: ou ambos commitam, ou nenhum. Cookie é setado FORA da
 * transação (não é DB), após o COMMIT — se setar cookie falhar
 * por algum motivo (raríssimo), o session token fica criado mas
 * sem cookie no cliente, o que é "esquecido" naturalmente quando
 * expira em 30 dias. Aceitável.
 */
export async function consumeMagicAndCreateSession(
  magicTokenHash: string,
  userId: string,
): Promise<void> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.transaction(async (tx) => {
    await tx
      .update(tokens)
      .set({ consumedAt: new Date() })
      .where(eq(tokens.tokenHash, magicTokenHash));

    await tx.insert(tokens).values({
      tokenHash: hash,
      userId,
      kind: 'session',
      expiresAt,
    });
  });

  await setSessionCookie(raw, expiresAt);

  // Activity log fora da transação — falhar aqui não invalida o login.
  void recordActivity(userId, 'login');
}

/** Read the session cookie and return the current user, or null.
 *  Filtra usuários soft-deleted (`deletedAt IS NULL`) — quem
 *  pediu exclusão LGPD não consegue mais autenticar mesmo
 *  segurando um cookie de sessão válido. Defesa-em-profundidade
 *  além do destroySessionsForUser que roda no soft-delete.
 *
 *  Resiliência: se a coluna `deleted_at` ainda não existe no DB
 *  (deploy onde a migration 0025 não rodou), cai pra query sem o
 *  filtro. Loga warning pra alertar — o cron LGPD ainda não está
 *  ativo em ambientes assim, então o risco efetivo é zero. */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const hash = hashToken(raw);
  try {
    const rows = await db
      .select({ user: users })
      .from(tokens)
      .innerJoin(users, eq(users.id, tokens.userId))
      .where(
        and(
          eq(tokens.tokenHash, hash),
          eq(tokens.kind, 'session'),
          gt(tokens.expiresAt, new Date()),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    return rows[0]?.user ?? null;
  } catch (err) {
    // Postgres erro 42703 = "undefined_column". Acontece se a
    // migration 0025_users_soft_delete não foi aplicada no DB
    // (timestamp do journal estava bagunçado em deploys antigos).
    // Fallback sem o filtro pra não deixar o usuário fora do app.
    const code = (err as { code?: string })?.code;
    if (code === '42703') {
      logger.warn('auth.session.deleted_at_missing', {
        hint: 'rode a migration 0025_users_soft_delete no DB',
      });
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
    throw err;
  }
}

/** Delete the cookie and the corresponding token row. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (raw) {
    await db.delete(tokens).where(eq(tokens.tokenHash, hashToken(raw)));
  }
  cookieStore.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  });
}
