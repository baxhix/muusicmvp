-- ============================================================
-- 0023_users_onboarding: flags do fluxo de auth unificado
-- ============================================================
-- O fluxo de auth refatorado (email-first → magic link →
-- onboarding) precisa que o backend saiba se um usuário JÁ
-- completou onboarding ou se acabou de chegar via magic link
-- e ainda falta birth-date/profile/interests.
--
-- Sem essa flag, a verify page do frontend caía pro check
-- naïve `Boolean(user.name)` — mas como o backend seeda
-- `name = email.split('@')[0]` pra contas novas, sempre era
-- true → onboarding era pulado.
-- ============================================================

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_onboarded" boolean NOT NULL DEFAULT false;

-- Campos coletados durante onboarding. Permitem age gating
-- (LGPD), personalização do feed inicial e auditoria de
-- aceite de termos.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "birth_date" text;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "age" integer;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_minor" boolean NOT NULL DEFAULT false;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp with time zone;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "interests" text[];

-- Backfill: usuários existentes ANTES desta migration já têm
-- conta funcional (acabaram de logar antes do fluxo novo);
-- marcamos como onboarded pra não derrubá-los no fluxo de
-- birth-date.
UPDATE "users" SET "is_onboarded" = true WHERE "is_onboarded" = false;
