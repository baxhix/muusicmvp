import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../env';
import * as schema from './schema';

declare global {

  var __pg_pool: Pool | undefined;
}

export const pool =
  global.__pg_pool ??
  new Pool({ connectionString: env.DATABASE_URL, max: 10 });

if (env.NODE_ENV !== 'production') global.__pg_pool = pool;

export const db = drizzle(pool, { schema });
export { schema };
