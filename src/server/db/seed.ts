import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { conversations, tracks } from './schema';
import { TRACKS_CATALOG } from '../../data/tracksCatalog';

/**
 * Idempotent seed: safe to re-run.
 *  - Inserts the global "Superchat" group conversation (slug='superchat').
 *  - Upserts the Ana Castela catalog into `tracks` keyed by youtube_id.
 *
 * Auto-joining users to the Superchat happens at signup time (in the auth
 * route), not here — this script only creates the row. Existing users get
 * joined retroactively the next time they sign in via /api/auth/me.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  // ── Superchat (idempotent on slug) ──────────────────────────────────────
  await db
    .insert(conversations)
    .values({ type: 'group', slug: 'superchat', name: 'Superchat' })
    .onConflictDoNothing({ target: conversations.slug });

  console.log('✓ Superchat conversation ensured');

  // ── Tracks catalog (idempotent on youtube_id) ───────────────────────────
  let inserted = 0;
  for (const t of TRACKS_CATALOG) {
    const result = await db
      .insert(tracks)
      .values({
        title: t.title,
        artist: t.artist,
        album: t.album ?? null,
        youtubeId: t.youtubeId,
      })
      .onConflictDoNothing({ target: tracks.youtubeId })
      .returning({ id: tracks.id });
    if (result.length) inserted++;
  }

  const total = await db.execute(sql`SELECT COUNT(*)::int AS n FROM tracks`);
  console.log(`✓ Tracks: ${inserted} inserted, ${total.rows[0].n} total in DB`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
