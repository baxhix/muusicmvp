// Standalone migration runner — uses just `drizzle-orm` (which IS in
// production deps) so we don't need the dev-only `drizzle-kit` or `tsx`
// in the runtime container.
//
// Shipped into the standalone Docker image and run from the entrypoint
// BEFORE the Next.js server starts. Idempotent: drizzle's migrator
// records applied migrations in `__drizzle_migrations` and skips ones
// already there.
//
// Plain `.mjs` (no TS) so it runs straight from `node` — no compile step.

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn('[migrate] DATABASE_URL not set — skipping migrations.');
  process.exit(0);
}

const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);

const folder = process.env.DRIZZLE_FOLDER ?? './drizzle';

try {
  console.log(`[migrate] applying migrations from ${folder}…`);
  await migrate(db, { migrationsFolder: folder });
  console.log('[migrate] done.');
} catch (err) {
  console.error('[migrate] failed:', err);
  // Don't crash the container — partial schemas have happened before
  // (manually-added migrations not in the snapshot). Let the app boot;
  // any feature that depends on a missing table will fail at request
  // time with a clearer error than a startup loop.
  process.exitCode = 0;
} finally {
  await pool.end();
}
