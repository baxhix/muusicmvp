-- Migration 0015: undo migration 0014.
--
-- The Algoritmo feature shipped in commit 8740bf4 and was then
-- decided to be re-thought from scratch. The code-side revert
-- removes the admin tab + API + server module + schema + types.
-- This migration drops the table the previous one created so
-- production matches the codebase again.
--
-- Idempotent (DROP IF EXISTS + CASCADE) so it's a no-op on any
-- environment where the table never made it in.
--
-- We don't re-use idx 14 — the previous 0014 migration was already
-- recorded as applied in __drizzle_migrations on prod. Drizzle
-- dedupes by hash, so introducing a new idx 15 keeps history
-- intact: 0013 applied, 0014 applied (and now meaningless), 0015
-- applied (drops the table).

DROP TABLE IF EXISTS "algorithm_rules" CASCADE;
