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
    });
  const instance = drizzle(pool, { schema });
  if (env.NODE_ENV !== 'production') {
    global.__pg_pool = pool;
    global.__pg_db = instance;
  }
  return instance;
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
