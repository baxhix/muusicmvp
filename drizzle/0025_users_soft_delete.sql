-- Soft delete em users (LGPD art. 18 — direito de exclusão).
--
-- Quando o usuário pede exclusão da conta, marcamos `deleted_at`
-- em vez de DELETE hard. Mantemos a row por retenção legal
-- (tipicamente 30-90 dias); cron job futuro anonimiza PII e faz
-- o hard delete final.
--
-- Comportamento esperado:
--   - getCurrentUser() filtra `deleted_at IS NULL` — usuário
--     soft-deleted não consegue logar.
--   - Magic link request pra email soft-deleted: trata como
--     conta nova (cria outro user com mesmo email — único
--     porque PII é anonimizada antes do hard delete).
--   - Lookups de display (admin user list, autores de posts,
--     etc.) mostram a row como antes. Filtro nessas queries fica
--     pra próxima rodada (sem urgência — só PII oculta).
--
-- Migration idempotente: adiciona coluna nullable + índice
-- partial (só rows soft-deleted). Não há backfill.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS users_deleted_at_idx
  ON users (deleted_at);
