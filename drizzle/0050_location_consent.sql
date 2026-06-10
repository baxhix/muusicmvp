-- Migration 0050: consentimento de localização (LGPD).
--
-- Adiciona users.location_consent — base legal pra DERIVAR, ARMAZENAR
-- e COMPARTILHAR a localização aproximada (city-level, jittered ~4km;
-- nunca GPS exato). Sem este flag = true:
--   • o auto-sync (useLocationSync) não dispara o prompt do SO;
--   • POST /api/me/location rejeita (a menos que grantConsent=true);
--   • o usuário não aparece no mapa de outros (listOnlineUsers filtra).
--
-- Default false = opt-in afirmativo daqui pra frente. As contas
-- EXISTENTES que já compartilharam localização (lat preenchido) são
-- grandfathered pra true — decisão de produto: a política vigente no
-- cadastro já divulgava o compartilhamento de localização aproximada,
-- e o usuário pode revogar em 1 toque nas Configurações.
--
-- Migração hand-written (o repo mantém o journal manualmente; os
-- snapshots do drizzle-kit estão defasados e NÃO são usados pelo
-- migrator em runtime). Guard IF NOT EXISTS torna a migração idempotente.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "location_consent" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

UPDATE "users" SET "location_consent" = true WHERE "lat" IS NOT NULL;
