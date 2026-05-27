-- Partial index pra acelerar `listConversationsForUser` e
-- `listMessages` que filtram por `kind = 'user'`.
--
-- Sem este index, o planner usava `msg_conv_created_idx` (que
-- cobre conversation_id + created_at) e filtrava por kind como
-- recheck — funcionava com tabela pequena, mas com 10k+ mensagens
-- por grupo ativo o bitmap recheck vira gargalo.
--
-- Partial WHERE kind = 'user' mantém o index pequeno: system events
-- ('system_join' / 'system_leave' / 'system_created') são raros
-- comparados a mensagens de usuário e NÃO precisam estar nesse
-- index (já que as queries que querem só user-msgs filtram kind).
--
-- ORDER BY created_at DESC bate exatamente com o `DISTINCT ON
-- (conversation_id) ... ORDER BY conversation_id, created_at DESC`
-- do `last_msg` CTE em queries.ts → index-only scan possível.

CREATE INDEX IF NOT EXISTS "msg_conv_kind_user_created_idx"
  ON "messages" ("conversation_id", "created_at" DESC)
  WHERE "kind" = 'user';
