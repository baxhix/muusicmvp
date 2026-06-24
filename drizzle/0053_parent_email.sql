-- E-mail do responsável pra contas de menores de idade (12–17).
-- Idempotente: ADD COLUMN IF NOT EXISTS pra rodar sem erro em ambientes
-- onde a coluna já exista.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_email" text;
