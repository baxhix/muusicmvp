-- Trocar PK `kind` por composta `(kind, surface)`.
--
-- Motivação: Termos de Uso e Política de Privacidade precisam
-- existir SEPARADAMENTE pra cada surface — site público, app,
-- plataforma web — porque costumam ter pequenas variações de
-- copy (loja de apps, artistas/criadores, visitantes). Antes
-- tinha 2 rows; agora vai pra 6 (2 kinds × 3 surfaces).
--
-- Migração:
--   1. Adiciona coluna `surface` com default 'site'.
--   2. Backfill: rows existentes ficam com surface='site' (a
--      única que tinha sentido na PK antiga — eram as docs do
--      site público).
--   3. Promove `surface` pra NOT NULL.
--   4. Dropa PK antiga em `kind`, cria composta `(kind, surface)`.
--   5. Insere as 4 rows novas (app + platform) × (termos + privacidade).
--
-- Idempotente: cada passo só executa se ainda não estiver no
-- estado-alvo (IF NOT EXISTS / DO $$ ... EXCEPTION).

-- 1. Adiciona coluna com default 'site' pra rows existentes herdarem.
ALTER TABLE "legal_documents"
  ADD COLUMN IF NOT EXISTS "surface" text NOT NULL DEFAULT 'site';

-- 2. Backfill defensivo — garante que toda row tem surface (no caso de
-- alguma ter sido criada com default removido por outra migration).
UPDATE "legal_documents"
SET "surface" = 'site'
WHERE "surface" IS NULL OR "surface" = '';

-- 3. Remove o default — `surface` deve ser explícito daqui pra frente.
ALTER TABLE "legal_documents"
  ALTER COLUMN "surface" DROP DEFAULT;

-- 4. Troca a PK. Drop da antiga, create da nova composta.
DO $$ BEGIN
  ALTER TABLE "legal_documents" DROP CONSTRAINT "legal_documents_pkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "legal_documents"
    ADD CONSTRAINT "legal_documents_pkey"
    PRIMARY KEY ("kind", "surface");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Seed das 4 rows novas (app + platform). As 2 antigas (site) já
-- existem e foram preservadas pelo backfill acima. ON CONFLICT DO
-- NOTHING torna a operação idempotente.
INSERT INTO "legal_documents" ("kind", "surface", "title", "body", "version", "published_at")
VALUES
  ('terms_of_use',   'app',      'Termos de Uso',           '', 1, NULL),
  ('privacy_policy', 'app',      'Política de Privacidade', '', 1, NULL),
  ('terms_of_use',   'platform', 'Termos de Uso',           '', 1, NULL),
  ('privacy_policy', 'platform', 'Política de Privacidade', '', 1, NULL)
ON CONFLICT ("kind", "surface") DO NOTHING;
