/**
 * HTTP trigger pro cron de interações em comunidades.
 *
 * Mesma estrutura dos outros cron endpoints: Bearer CRON_SECRET +
 * POST → run → JSON com stats.
 */

import { NextResponse } from 'next/server';
import { env } from '@/server/env';
import { runCommunityInteractions } from '@/server/cron/communityInteractions';
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
    const result = await runCommunityInteractions();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error('api.cron.community-interactions.failed', err);
    return NextResponse.json(
      { error: 'cron_failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
