-- ============================================================
-- 0022_auth_otp_code: OTP fallback ao lado do magic link
-- ============================================================
-- O backend atual envia só o magic link (URL com token base64).
-- Esta migration adiciona um código de 6 dígitos paralelo, pra
-- que o email inclua AMBOS (link clicável + código digitável).
--
-- Estrutura:
--   - Coluna `code` (text) na tabela tokens, opcional. Existe
--     pra kind='magic'; null pra kind='session'.
--   - Index composto (code, kind) pra lookup eficiente em
--     /api/auth/verify com {email, code}.
-- ============================================================

ALTER TABLE "tokens" ADD COLUMN IF NOT EXISTS "code" text;

-- Lookups: encontrar magic token pelo código de 6 dígitos.
CREATE INDEX IF NOT EXISTS "tokens_code_kind_idx"
  ON "tokens" ("code", "kind")
  WHERE "code" IS NOT NULL;
