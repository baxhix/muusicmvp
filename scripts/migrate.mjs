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
//
// FAIL-HARD CONTRACT
// ──────────────────
// Pré-incidente do migration 0035 (Aquisição), este script engolia
// erros silenciosamente (`process.exitCode = 0`) e o entrypoint.sh
// continuava o boot. A teoria era "trocar feature quebrada por outage
// é pior". A PRÁTICA foi pior ainda: usuários viam login 500 em prod
// SEM nenhum alerta, e a equipe descobria só por bug report.
//
// Trade-off invertido agora:
//   - Migration falhou → exit 1 → entrypoint.sh aborta → container
//     reinicia em loop → Docker health-check marca como unhealthy →
//     alerta dispara. Operador é notificado em minutos.
//   - Vs. silêncio anterior: feature quebrava em prod sem aviso
//     algum, e bug ficava online por horas até alguém reportar.
//
// PRE-FLIGHT: detecta SQL files no /drizzle/ que NÃO têm entrada no
// _journal.json (problema raiz do incidente Aquisição — 0035 escrito
// à mão sem `db:generate`). Bloqueia o boot com erro explícito antes
// de tentar rodar a migration.

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn('[migrate] DATABASE_URL not set — skipping migrations.');
  process.exit(0);
}

const folder = process.env.DRIZZLE_FOLDER ?? './drizzle';

/**
 * Pre-flight: cross-check SQL files vs _journal.json entries.
 *
 * Se alguém escreveu um SQL à mão (em vez de rodar `db:generate`)
 * sem adicionar entrada no journal, o drizzle migrator vai IGNORAR
 * silenciosamente — exatamente o que aconteceu com 0035. Detectamos
 * isso ANTES de chamar `migrate()` pra dar erro claro.
 */
async function checkJournalSync() {
  let journal;
  try {
    const raw = await readFile(join(folder, 'meta', '_journal.json'), 'utf8');
    journal = JSON.parse(raw);
  } catch (err) {
    console.warn('[migrate] no _journal.json found — pre-flight skipped');
    return;
  }
  if (!journal?.entries || !Array.isArray(journal.entries)) {
    console.warn('[migrate] _journal.json malformed — pre-flight skipped');
    return;
  }

  const journalTags = new Set(journal.entries.map((e) => e.tag));
  let files;
  try {
    files = await readdir(folder);
  } catch (err) {
    console.warn('[migrate] cannot read folder — pre-flight skipped');
    return;
  }

  const sqlFiles = files
    .filter((f) => f.endsWith('.sql'))
    .map((f) => f.replace(/\.sql$/, ''));

  const orphans = sqlFiles.filter((tag) => !journalTags.has(tag));
  if (orphans.length > 0) {
    console.error(
      '[migrate] FATAL: SQL files without _journal.json entries detected:',
    );
    for (const tag of orphans) {
      console.error(`  - drizzle/${tag}.sql`);
    }
    console.error(
      '[migrate] These migrations will NEVER be applied automatically.',
    );
    console.error(
      '[migrate] Add corresponding entries to drizzle/meta/_journal.json',
    );
    console.error('[migrate] or regenerate via `pnpm db:generate`.');
    process.exit(1);
  }
}

const pool = new Pool({ connectionString: url, max: 1 });
const db = drizzle(pool);

try {
  await checkJournalSync();
  console.log(`[migrate] applying migrations from ${folder}…`);
  await migrate(db, { migrationsFolder: folder });
  console.log('[migrate] done.');
} catch (err) {
  console.error('[migrate] FAILED:', err);
  console.error(
    '[migrate] aborting boot — entrypoint will exit non-zero and container will restart.',
  );
  /* FAIL-HARD: ao contrário da versão antiga (que setava
   * exitCode=0 pra mascarar), agora propagamos o exit code 1.
   * O entrypoint.sh tem `set -e` correspondente e aborta o
   * boot, forçando alerta via Docker health checks. */
  process.exitCode = 1;
} finally {
  await pool.end();
}
