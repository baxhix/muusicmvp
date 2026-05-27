import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/server/db';
import { users, tokens } from '@/server/db/schema';
import { generateToken, generateCode, MAGIC_TTL_MS } from '@/server/auth/tokens';
import { sendMagicLink, buildMagicUrl } from '@/server/email/magicLink';
import { sendWelcomeEmail } from '@/server/email/welcome';
import { env } from '@/server/env';
import { and, eq, isNull } from 'drizzle-orm';
import { limitByIp, limitByKey, magicLinkLimiter } from '@/server/rateLimit';
import { TokenBucket } from '@/server/realtime/rateLimit';
import { logger } from '@/server/log';

/* Bucket por email pra prevenir inbox-spam: mesmo que o atacante
 *  use IPs diferentes, não consegue floodar UM endereço específico.
 *  3 requests / 10min = 3 burst, refill 0.005/s. */
const perEmailLimiter = new TokenBucket(3, 0.005);

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
  /* Rate limit POR IP — primeira camada, antes de qualquer
   *  trabalho. Atacante com 1 IP só consegue 5 requests/min. */
  const ipLimit = limitByIp(req, magicLinkLimiter, 'auth.request');
  if (!ipLimit.ok) return ipLimit.response;

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { email } = parsed;
  const returnTo = sanitizeReturnTo(parsed.returnTo);

  /* Rate limit POR EMAIL — segunda camada, protege a vítima de
   *  receber inbox-spam mesmo se atacante rodar IPs diferentes.
   *  3 emails por 10min, sustentado. */
  const emailLimit = limitByKey(email, perEmailLimiter);
  if (!emailLimit.ok) {
    logger.warn('auth.request.rate-limited', { email });
    return emailLimit.response;
  }

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
  const defaultName = email.split('@')[0];
  const { raw, hash } = generateToken();
  const code = generateCode(); // 6-digit OTP fallback

  // Atômico: upsert user + cria magic token na MESMA transação.
  // Sem isso, falha entre INSERT users e INSERT tokens deixava
  // user fantasma sem token (próxima request criava token novo, mas
  // já tinha gravado o user inutilmente). Agora ou ambos comitam,
  // ou nenhum. Email é enviado FORA da transação (não dá pra
  // rollback de I/O HTTP — se o token comitar e o email falhar,
  // o token órfão expira em 15min naturalmente).
  //
  // Também retornamos `isNewUser` pra que, fora da transação,
  // possamos disparar o email de boas-vindas APENAS pra criação
  // real de conta (não pra logins subsequentes). Combinado com o
  // claim atômico abaixo (UPDATE WHERE welcomeEmailSentAt IS NULL),
  // garante que boas-vindas sai uma única vez no momento da
  // criação de conta — mesmo em corridas concorrentes.
  /* HOTFIX: a atribuição de aquisição (cookie `fanverse_ref` →
   * users.signup_link_id) foi removida temporariamente porque
   * a migração 0035 falhou silenciosamente em prod, deixando
   * a coluna inexistente — qualquer SELECT/INSERT que a
   * referenciasse explodia o login com 500.
   *
   * Restaurar depois que confirmar que a migration rodou. O
   * resto da Aquisição (admin UI, /r/[slug] redirect com
   * cookie) continua funcionando — só o write final do
   * `signup_link_id` no user novo está suspenso. */
  const { user, isNewUser } = await db.transaction(async (tx) => {
    // Filtra soft-deleted: usuário que pediu exclusão LGPD não
    // recebe magic link mesmo digitando o mesmo email. Se quiser
    // voltar, vai precisar do hard-delete final (cron job dropa
    // a row após o período de retenção) e cadastrar de novo —
    // no banco, vira conta nova.
    const existing = await tx
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    const isNew = !existing[0];
    const u =
      existing[0] ??
      (await tx.insert(users).values({ email, name: defaultName }).returning())[0];

    await tx.insert(tokens).values({
      tokenHash: hash,
      userId: u.id,
      kind: 'magic',
      code,
      expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
    });
    return { user: u, isNewUser: isNew };
  });

  /**
   * Toda vez que um usuário loga (não só novos cadastros),
   * queremos que ele caia no /app com a câmera centrada em
   * LATAM/Brasil. O produto é Brasil-first; abrir o app com
   * câmera global default (em uma sessão nova após magic-link)
   * fica desorientador per product feedback "sempre que um
   * usuário fizer login, o globo deve ser exibido na região do
   * Brasil".
   *
   * Reaproveitamos o `returnTo` da magic link — sanitizado
   * contra um allowlist em ambos os endpoints (request +
   * verify). Quando o cliente já mandou um returnTo próprio
   * (admin cross-subdomain, deep link, etc.), respeitamos a
   * intenção dele.
   *
   * O Globe.tsx detecta `?welcome=1` e ignora o
   * loadGlobeCamera() pra forçar LATAM no primeiro frame; em
   * seguida limpa o query param via history.replaceState pra
   * que F5 subsequente já use o estado persistido normal.
   */
  const effectiveReturnTo =
    returnTo ?? `${env.APP_URL.replace(/\/+$/, '')}/app?welcome=1`;

  /* Switch de email baseado em "conta nova vs. relogin":
   *   - isNewUser=true  → template `boas_vindas` (cadastrado em
   *     /admin/emails/templates/boas_vindas/edit). Esse template
   *     carrega o magic link + código OTP do primeiro acesso, então
   *     o user recebe UM ÚNICO email com cadastro + acesso.
   *   - isNewUser=false → template `magic_link` (acesso recorrente).
   *
   * Observação de privacidade: o response da rota continua igual
   * pros dois casos ("ok: true"), pra não revelar via timing/payload
   * se o email já existia. A diferenciação só aparece no inbox do
   * dono real do email — quem tem acesso, sabe se foi cadastrado
   * agora ou já tinha conta. Trade-off explícito de UX vs. anti-
   * enumeration.
   *
   * Pra criação de conta, fazemos um claim atômico em
   * welcomeEmailSentAt antes do envio. Isso protege contra:
   *   1. Race condition: dois POSTs simultâneos pro mesmo email
   *      novo — só um vence o claim.
   *   2. Legacy/rollback: se essa rota for redeployada após uma
   *      versão antiga que disparava no onboarding, não duplica. */
  if (isNewUser) {
    const claimed = await db
      .update(users)
      .set({ welcomeEmailSentAt: new Date() })
      .where(
        and(eq(users.id, user.id), isNull(users.welcomeEmailSentAt)),
      )
      .returning({ id: users.id, email: users.email, name: users.name });

    const claimWon = claimed.length > 0;
    /* Quando o claim NÃO foi nosso (legacy: welcomeEmailSentAt já
     * setado por versão antiga, ou race com outro POST), caímos no
     * magic_link normal — o usuário ainda precisa de um link de
     * acesso, só que não vamos remandar boas-vindas. */
    if (!claimWon) {
      try {
        await sendMagicLink(email, raw, code, effectiveReturnTo);
      } catch (err) {
        logger.error('auth.request.email-send', err, { email });
        return NextResponse.json({ error: 'email_failed' }, { status: 502 });
      }
    } else {
      const row = claimed[0];
      const displayName = row.name ?? defaultName;
      const magicUrl = buildMagicUrl(raw, effectiveReturnTo);
      try {
        await sendWelcomeEmail({
          to: row.email,
          userName: displayName,
          magicUrl,
          code,
        });
      } catch (err) {
        logger.error('auth.request.welcome-send-failed', err, {
          userId: row.id,
        });
        return NextResponse.json({ error: 'email_failed' }, { status: 502 });
      }
    }
  } else {
    try {
      await sendMagicLink(email, raw, code, effectiveReturnTo);
    } catch (err) {
      logger.error('auth.request.email-send', err, { email });
      return NextResponse.json({ error: 'email_failed' }, { status: 502 });
    }
  }

  // Don't reveal whether the user already existed.
  return NextResponse.json({ ok: true });
}
