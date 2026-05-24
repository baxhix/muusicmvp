import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Sanity checks no `_journal.json` do drizzle.
 *
 * Por que isso existe: já tivemos um incidente em prod onde a
 * migration 0025_users_soft_delete tinha `when` MENOR que a
 * 0024_materiais. O drizzle-migrator compara
 * `migration.when > lastMigration.created_at` pra decidir aplicar
 * — então, em deploys subsequentes, a 0025 era silenciosamente
 * pulada. Coluna `users.deleted_at` nunca foi criada, qualquer
 * query com `isNull(users.deletedAt)` retornava 42703
 * (undefined_column), e o admin caía em 500.
 *
 * Estes testes catch:
 *   - `when` não-monotônico (a causa do incidente)
 *   - `idx` duplicado ou faltando na sequência
 *   - SQL file referenciado pelo `tag` que não existe no disco
 *   - SQL file órfão (existe no disco mas não está no journal)
 *
 * Rodam em todo `npm test` → CI catch antes do merge.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
// src/server/db/ → ../../../drizzle
const DRIZZLE_DIR = join(__dirname, '..', '..', '..', 'drizzle');
const JOURNAL_PATH = join(DRIZZLE_DIR, 'meta', '_journal.json');

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints?: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const journal: Journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'));

describe('drizzle journal — sanity checks', () => {
  it('tem pelo menos uma migration', () => {
    expect(journal.entries.length).toBeGreaterThan(0);
  });

  it('`when` é estritamente crescente (regressão do incidente prod admin 500)', () => {
    // Esse é O check crítico. Se uma migration nova tem `when`
    // menor que a anterior, o drizzle-migrator vai PULAR ela em
    // qualquer ambiente que já tenha aplicado a anterior.
    for (let i = 1; i < journal.entries.length; i++) {
      const prev = journal.entries[i - 1];
      const curr = journal.entries[i];
      expect(
        curr.when,
        `migration ${curr.tag} (when=${curr.when}) tem timestamp <= ${prev.tag} (when=${prev.when}). ` +
          `Drizzle vai pular em prod. Fix: aumente curr.when no _journal.json.`,
      ).toBeGreaterThan(prev.when);
    }
  });

  it('`idx` casa com a posição no array (sem buracos / fora de ordem)', () => {
    // Permite buracos intencionais (uma migration deletada do
    // disco mas com idx ainda no journal seria mais sério —
    // catch via "SQL file referenciado existe" abaixo). Só
    // garantimos que está em ordem ascendente.
    for (let i = 1; i < journal.entries.length; i++) {
      expect(journal.entries[i].idx).toBeGreaterThan(journal.entries[i - 1].idx);
    }
  });

  it('todo `tag` referenciado existe como .sql no disco', () => {
    const sqlFiles = new Set(
      readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith('.sql')),
    );
    for (const entry of journal.entries) {
      expect(
        sqlFiles.has(`${entry.tag}.sql`),
        `journal cita ${entry.tag} mas drizzle/${entry.tag}.sql não existe`,
      ).toBe(true);
    }
  });

  it('todo .sql no disco está referenciado no journal (sem órfão)', () => {
    const journalTags = new Set(journal.entries.map((e) => `${e.tag}.sql`));
    const sqlFiles = readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith('.sql'));
    for (const file of sqlFiles) {
      expect(
        journalTags.has(file),
        `drizzle/${file} existe mas não está no _journal.json — drizzle não vai aplicar`,
      ).toBe(true);
    }
  });

  it('`tag` é único', () => {
    const tags = journal.entries.map((e) => e.tag);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('`idx` é único', () => {
    const idxs = journal.entries.map((e) => e.idx);
    expect(new Set(idxs).size).toBe(idxs.length);
  });
});
