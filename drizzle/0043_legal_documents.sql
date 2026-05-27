-- Documentos legais (Termos de Uso, Política de Privacidade).
--
-- Tabela com 2 rows fixas — uma por `kind`. Não é uma lista
-- dinâmica de CRUD; o admin edita os 2 documentos existentes e
-- pode publicar. O seed abaixo garante que as rows sempre existem
-- — o admin nunca precisa "criar do zero", só editar o body e
-- clicar "Publicar".
--
-- `version` bumpa em cada publicação pra UI mostrar "v.X publicada
-- em Y". `published_at` null = ainda não apareceu no site público.

CREATE TABLE IF NOT EXISTS "legal_documents" (
  "kind" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "version" integer NOT NULL DEFAULT 1,
  "published_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "updated_by" uuid
);

DO $$ BEGIN
  ALTER TABLE "legal_documents"
    ADD CONSTRAINT "legal_documents_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed das 2 rows fixas. INSERT … ON CONFLICT DO NOTHING garante
-- idempotência: rodar a migration de novo (ou em ambientes que
-- já manualmente criaram a tabela) não sobrescreve nada.
INSERT INTO "legal_documents" ("kind", "title", "body", "version", "published_at")
VALUES
  ('terms_of_use',    'Termos de Uso',        '', 1, NULL),
  ('privacy_policy',  'Política de Privacidade', '', 1, NULL)
ON CONFLICT ("kind") DO NOTHING;
