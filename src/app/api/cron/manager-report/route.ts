/**
 * HTTP trigger pro cron de relatório do gestor.
 *
 * Mesma estrutura do /api/cron/daily-digest: Bearer token + POST +
 * delegação pro runner em src/server/cron/managerDailyReport.ts.
 *
 * Agendar:
 *   - cron-job.org / Vercel Cron / systemd timer → POST 06h00 BRT
 *     com Authorization: Bearer ${CRON_SECRET}
 */

import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { runManagerDailyReport } from '@/server/cron/managerDailyReport';
import { logger } from '@/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: Request): boolean {
  const secret = env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
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
    const result = await runManagerDailyReport();
    return NextResponse.json({ ok: result.sent, ...result });
  } catch (err) {
    logger.error('api.cron.manager-report.failed', err);
    return NextResponse.json(
      { error: 'cron_failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
