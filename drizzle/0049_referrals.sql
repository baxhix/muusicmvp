-- Migration 0049: loop viral / referral usuário→usuário.
--
-- Adiciona:
--   • users.referral_code        — código único e estável de cada
--                                   usuário (compartilhado via /i/{code}).
--   • users.referred_by_user_id  — quem convidou este usuário (self-ref FK).
--   • tabela referrals           — uma row por convite atribuído, com
--                                   máquina de estados pending→activated→rewarded.
--   • fanpoint_rules             — regras `referral_bonus` (crédito pro
--                                   referrer) e `referral_welcome` (bônus
--                                   pro convidado), editáveis no admin.
--
-- O reward só é creditado na ATIVAÇÃO (convidado completa onboarding),
-- nunca no signup puro — anti-fraude. referred_id UNIQUE garante 1
-- referral por convidado (idempotência da atribuição).
--
-- Migração hand-written (o repo mantém o journal manualmente; os
-- snapshots do drizzle-kit estão defasados e NÃO são usados pelo
-- migrator em runtime). Guards IF [NOT] EXISTS / DO-block tornam a
-- migração idempotente.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referred_by_user_id" uuid;
--> statement-breakpoint

-- Backfill: gera um code estável pros users existentes a partir do
-- UUID (10 hex chars upper = 40 bits — colisão desprezível na escala
-- de lançamento; o UNIQUE abaixo trava qualquer colisão eventual).
UPDATE "users"
  SET "referral_code" = upper(substr(replace("id"::text, '-', ''), 1, 10))
  WHERE "referral_code" IS NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE ("referral_code");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_user_id_users_id_fk"
    FOREIGN KEY ("referred_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "referrals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "referrer_id" uuid NOT NULL,
  "referred_id" uuid NOT NULL,
  "code" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reward_points" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "activated_at" timestamp with time zone,
  "rewarded_at" timestamp with time zone,
  CONSTRAINT "referrals_referred_id_unique" UNIQUE("referred_id")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk"
    FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_users_id_fk"
    FOREIGN KEY ("referred_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_status_idx" ON "referrals" USING btree ("status");
--> statement-breakpoint

-- Regras de Fanpoints do referral (editáveis depois via admin
-- /configurações/fanpoints, igual às demais regras integradas).
INSERT INTO "fanpoint_rules" ("kind", "points") VALUES
  ('referral_bonus', 50),
  ('referral_welcome', 30)
ON CONFLICT ("kind") DO NOTHING;
