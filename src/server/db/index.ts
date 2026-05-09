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
    new Pool({ connectionString: env.DATABASE_URL, max: 10 });
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
