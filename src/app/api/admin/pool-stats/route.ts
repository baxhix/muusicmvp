import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/auth/requireAdmin';
import { getPoolStats } from '@/server/db';
import { logger } from '@/server/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Operational health endpoint — current state of the pg.Pool plus a
 * single SHOW round-trip that proves session-level GUCs are applied.
 *
 * Returns:
 *   pool.total    — connections currently checked out OR idle in pool
 *   pool.idle     — connections sitting idle, ready for re-use
 *   pool.waiting  — requests stuck waiting for a free connection
 *                   (anything > 0 sustained = pool too small)
 *   pool.max      — configured ceiling (50 after the recent perf commit)
 *   timeouts.statement_timeout  — the actual session value the driver
 *                                 applied. Should be "5s" / "5000ms".
 *   timeouts.idle_in_tx_timeout — should be "10s" / "10000ms".
 *
 * Admin-gated so it doesn't leak internals to anonymous users.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const stats = getPoolStats();

  // Read the actual GUCs FROM the pooled connection so we're
  // observing what the app sees, not the postgres server default.
  // Import db late so this file remains importable in tests where
  // env isn't set yet.
  const { db } = await import('@/server/db');
  // Drizzle's execute() lets us run raw SQL through the same pool.
  // SHOW returns a single column named after the GUC itself.
  let stmtTimeout = 'n/a';
  let idleTxTimeout = 'n/a';
  try {
    // Two separate execute() calls — the pg driver returns each
    // SHOW as its own row set, easier than splitting a combined
    // result.
    const a = (await db.execute(
      `SHOW statement_timeout`,
    )) as unknown as { rows: Array<{ statement_timeout?: string }> };
    stmtTimeout = a.rows[0]?.statement_timeout ?? 'n/a';
    const b = (await db.execute(
      `SHOW idle_in_transaction_session_timeout`,
    )) as unknown as {
      rows: Array<{ idle_in_transaction_session_timeout?: string }>;
    };
    idleTxTimeout = b.rows[0]?.idle_in_transaction_session_timeout ?? 'n/a';
  } catch (err) {
    logger.warn('admin.pool-stats.gucs');
  }

  return NextResponse.json({
    pool: stats,
    timeouts: {
      statement_timeout: stmtTimeout,
      idle_in_tx_timeout: idleTxTimeout,
    },
    // ISO timestamp so a polling client can detect when its sample
    // arrived (and not over-trust an aging cached page).
    sampledAt: new Date().toISOString(),
  });
}
