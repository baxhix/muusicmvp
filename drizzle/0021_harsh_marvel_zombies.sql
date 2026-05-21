-- Migration 0021: fanpoint_rules table — points-per-kind override
-- editável pelo admin (aba Configurações → Fanpoints).
--
-- recordActivity() consulta esta tabela com cache curto (60s) e
-- usa o `points` daqui ao inserir na user_activities. Quando a
-- tabela está vazia, o código cai num fallback hardcoded no
-- src/server/activities/queries.ts → tabela vazia não quebra o
-- runtime.
--
-- O `kind` espelha o enum de user_activities.kind (text + CHECK)
-- pra que adicionar uma nova kind exija passar nos dois lugares.
-- A drizzle gera essa tabela automaticamente a partir do schema,
-- mas o auto-gerador estava propondo recriar tabelas já
-- existentes em prod — esta migration foi escrita à mão pra
-- conter SOMENTE o que é novo, igual ao padrão do 0009_site_tags.
--
-- Idempotente: CREATE IF NOT EXISTS + DO/EXCEPTION pro FK +
-- INSERT ON CONFLICT DO NOTHING pro seed inicial.

CREATE TABLE IF NOT EXISTS "fanpoint_rules" (
  "kind" text PRIMARY KEY NOT NULL,
  "points" integer NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fanpoint_rules" ADD CONSTRAINT "fanpoint_rules_updated_by_users_id_fk"
   FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Seed: traz os 7 valores atuais da constante POINTS de
-- src/server/activities/queries.ts pra dentro do banco. Assim o
-- comportamento pós-migration permanece idêntico ao pré-migration,
-- e o admin já edita valores reais.
INSERT INTO "fanpoint_rules" ("kind", "points")
VALUES
  ('stream',         0),
  ('login',          50),
  ('chat_started',   3),
  ('post_liked',     5),
  ('comment_posted', 10),
  ('post_shared',    15),
  ('three_streams',  10)
ON CONFLICT ("kind") DO NOTHING;
