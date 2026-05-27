-- Bug fix: "apagar conversa" deve esconder o histórico anterior
-- pra QUEM apagou, mesmo se a conversa ressurgir (via search ou
-- nova mensagem da outra parte).
--
-- Antes: `hidden_at` cumpria duplo papel — esconder a conv da
-- lista E sinalizar "deletei". Quando a outra parte mandava
-- msg nova OU o user clicava no /search, a conv reaparecia
-- INTEIRA, incluindo o histórico anterior — incorreto.
--
-- Agora dois campos separados:
--   `hidden_at`              — esconde da lista (1:1 com o request
--                              do user "apagar pra mim"). Limpado
--                              quando o user reabre a conv via
--                              search OU quando a outra parte
--                              manda msg nova.
--
--   `cleared_history_before` — corte do timeline. NUNCA limpado.
--                              Mensagens com created_at <= esse
--                              timestamp ficam ocultas pra esse
--                              user permanentemente. Vira PROOF
--                              do "apaguei" mesmo depois da conv
--                              reaparecer.
--
-- Apagar a conv seta os DOIS pra now(). Reabrir limpa só hidden_at.

ALTER TABLE "conversation_participants"
  ADD COLUMN IF NOT EXISTS "cleared_history_before" timestamptz;

-- Backfill: rows com hidden_at já setado tinham a semântica
-- antiga (mas o histórico não estava sendo filtrado). Pra preservar
-- o comportamento *prometido*, setamos cleared_history_before =
-- hidden_at em quem JÁ apagou — assim quando essa migration
-- rodar em prod, os users que tinham apagado conv terão o
-- histórico filtrado a partir desse momento.
UPDATE "conversation_participants"
SET "cleared_history_before" = "hidden_at"
WHERE "hidden_at" IS NOT NULL
  AND "cleared_history_before" IS NULL;
