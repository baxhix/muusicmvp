import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env';
import * as schema from './schema';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {

  var __pg_pool: Pool | undefined;

  var __pg_db: DrizzleDb | undefined;
}

function loadDb(): DrizzleDb {
  if (global.__pg_db) return global.__pg_db;
  const pool =
    global.__pg_pool ??
    new Pool({
      connectionString: env.DATABASE_URL,
      // Was 10 — too tight for ~50 concurrent chat:send/react. Each
      // path takes 3-4 queries, so 10 connections × ~50ms/query =
      // ~200 q/s ceiling, which we hit at <100 active users. Raise
      // to 50: comfortably handles 1k+ users with headroom for
      // analytics + admin queries on the side. Postgres itself
      // handles 100+ idle connections fine on modern hardware.
      max: 50,
      // Defense against a runaway query holding a connection: cap
      // every query at 5s. The chat-side queries take <50ms in
      // healthy conditions; anything above 5s is almost certainly a
      // bug (missing index, lock contention, etc.) and we'd rather
      // surface it as a clear error than slowly drain the pool.
      statement_timeout: 5_000,
      // Also cap idle-in-transaction so an aborted client can't keep
      // a row-lock indefinitely.
      idle_in_transaction_session_timeout: 10_000,
      // Stamp the app name so pg_stat_activity rows from this pool
      // are easy to spot vs an external psql session.
      application_name: 'muusic-web',
    });
  const instance = drizzle(pool, { schema });
  // Cache the pool reference globally in dev (HMR creates new module
  // instances) AND in prod, so the new pool-stats route below can
  // reach it without re-creating a pool.
  global.__pg_pool = pool;
  if (env.NODE_ENV !== 'production') {
    global.__pg_db = instance;
  } else {
    global.__pg_db = instance;
  }
  return instance;
}

/** Pool diagnostics for ops health-check / capacity verification.
 *  Returns the current counts from the underlying pg.Pool. */
export function getPoolStats(): {
  total: number;
  idle: number;
  waiting: number;
  max: number;
} {
  loadDb();
  const pool = global.__pg_pool;
  if (!pool) return { total: 0, idle: 0, waiting: 0, max: 0 };
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    // pg.Pool doesn't expose max as a public field but stamps it
    // as `options.max` internally. Cast carefully.
    max:
      (pool as unknown as { options?: { max?: number } }).options?.max ??
      0,
  };
}

/**
 * Lazy db client. The Postgres Pool + drizzle instance are only created on
 * first property access — so Next.js's build-time module analysis can import
 * this file without the runtime envs being available.
 */
export const db = new Proxy({} as DrizzleDb, {
  get(_t, prop: string | symbol) {
    const real = loadDb() as unknown as Record<string | symbol, unknown>;
    return real[prop];
  },
});

export { schema };
