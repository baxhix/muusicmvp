/**
 * HTTP trigger pro cron de resumo diário.
 *
 * Uso: agendar POST aqui via cron-job.org / Vercel Cron / systemd
 * timer com Authorization: Bearer ${CRON_SECRET}. O cron real é o
 * `runDailyDigest()` em src/server/cron/dailyDigest.ts — esta rota
 * é só o wrapper HTTP.
 *
 * Auth: Bearer token batendo CRON_SECRET. Se CRON_SECRET não estiver
 * setado em env, a rota retorna 503 (configuração ausente) — não
 * deixamos a feature "aberta" por engano em ambientes mal
 * configurados.
 *
 * Idempotência: o cron em si não tem gate por dia (ver
 * dailyDigest.ts header). Se chamar 2x no mesmo dia, manda 2 emails
 * pra cada user. Aceita-se pra MVP; tabela `daily_digest_log` é
 * TODO v2.
 *
 * Por que POST (e não GET): GETs em URLs podem ser pre-fetched ou
 * cached por bots/crawlers. POST exige client deliberado.
 */

import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { runDailyDigest } from '@/server/cron/dailyDigest';
import { logger } from '@/server/log';

export const runtime = 'nodejs';

/* `dynamic = 'force-dynamic'` impede caching em qualquer edge —
 * cron route NUNCA deve ser cacheado. */
export const dynamic = 'force-dynamic';

function isAuthorized(req: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  /* Aceita "Bearer <token>" (padrão Vercel Cron + cron-job.org) ou
   * o token raw como fallback (admins manuais via curl). */
  const provided = header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : header.trim();
  return provided === secret;
}

export async function POST(req: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'cron_disabled', detail: 'CRON_SECRET não configurado' },
      { status: 503 },
    );
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyDigest();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error('api.cron.daily-digest.failed', err);
    return NextResponse.json(
      { error: 'cron_failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
