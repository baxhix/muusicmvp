/**
 * Health-check endpoint público.
 *
 * Uso:
 *   - Docker healthcheck (substituir o `pg_isready`-only)
 *   - Load balancer probes quando migrarmos pra multi-instance
 *   - Manual: `curl https://muusic.live/api/health` confirma
 *     que web + DB estão respondendo
 *
 * Retorna 200 quando tudo OK, 503 (Service Unavailable) quando
 * algum check falha. Body JSON tem detalhes por subsistema pra
 * facilitar diagnóstico.
 *
 * NÃO exige auth — se alguém quiser ver "muusic está online?"
 * a resposta é pública. Não vazamos nada sensível.
 */

import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db, getPoolStats } from '@/server/db';
import { logger } from '@/server/log';

export const runtime = 'nodejs';
/* Sempre dinâmico — não cachear o resultado do health-check. */
export const dynamic = 'force-dynamic';

interface CheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded';
  uptime: number;
  checks: {
    db: CheckResult;
  };
  pool: ReturnType<typeof getPoolStats>;
  ts: string;
}

async function checkDb(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    logger.error('health.db', err);
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const dbResult = await checkDb();
  const allOk = dbResult.ok;

  const body: HealthResponse = {
    status: allOk ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()),
    checks: { db: dbResult },
    pool: getPoolStats(),
    ts: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
