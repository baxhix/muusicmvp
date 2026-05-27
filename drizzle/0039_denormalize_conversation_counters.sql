-- Denormaliza contadores quentes pra eliminar subqueries correlacionadas
-- no `listConversationsForUser` (P0.2 da auditoria).
--
-- Antes: cada GET /api/conversations rodava 3 subqueries POR linha:
--   - unread_count = 2 lookups (aggregate + scalar pra resolver
--     last_read_message_id em created_at)
--   - member_count = COUNT(*) em conversation_participants
--   - last_msg = DISTINCT ON ordenando messages por created_at DESC
--                + JOIN com user pra avatar
--
-- Pra users com 50 conversas isso vira ~150 round-trips internos do
-- planner por GET. Em prod com Superchat viral, é o caminho mais
-- rápido pra ferver o pool do Postgres.
--
-- Solução: manter contadores denormalizados que são atualizados
-- pelo escrita-side (sendMessage, markRead, addMember, removeMember,
-- createGroup, removeMember). O list query vira um SELECT simples
-- com ORDER BY index + LIMIT + cursor pra paginação.

-- ────────────────────────────────────────────────────────────
-- conversations: last_message_at + last_message_id + member_count
-- ────────────────────────────────────────────────────────────
ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "last_message_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "last_message_id" uuid,
  ADD COLUMN IF NOT EXISTS "member_count" integer NOT NULL DEFAULT 0;

-- Index pra ordenação rápida no list (substitui o COALESCE no SQL).
-- Inclui id e created_at pra que o list possa fazer cursor stable.
CREATE INDEX IF NOT EXISTS "conv_last_message_at_idx"
  ON "conversations" ("last_message_at" DESC NULLS LAST);

-- Backfill — pra cada conversa, busca a última mensagem (kind='user')
-- e popula. Roda 1× na migration; depois é mantido pelo app.
UPDATE "conversations" c
SET
  "last_message_at" = lm."created_at",
  "last_message_id" = lm."id"
FROM (
  SELECT DISTINCT ON (conversation_id)
    conversation_id, id, created_at
  FROM "messages"
  WHERE kind = 'user'
  ORDER BY conversation_id, created_at DESC
) lm
WHERE c.id = lm.conversation_id;

-- Backfill do member_count (só ATIVOS — quem saiu não conta).
UPDATE "conversations" c
SET "member_count" = sub.cnt
FROM (
  SELECT conversation_id, COUNT(*)::int AS cnt
  FROM "conversation_participants"
  WHERE "left_at" IS NULL
  GROUP BY conversation_id
) sub
WHERE c.id = sub.conversation_id;

-- ────────────────────────────────────────────────────────────
-- conversation_participants: unread_count
-- ────────────────────────────────────────────────────────────
ALTER TABLE "conversation_participants"
  ADD COLUMN IF NOT EXISTS "unread_count" integer NOT NULL DEFAULT 0;

-- Backfill: pra cada (conversation, user), conta mensagens 'user'
-- de OUTROS users que são mais novas que o last_read_message_id
-- (ou TODAS as user-msgs se nunca leu).
UPDATE "conversation_participants" cp
SET "unread_count" = sub.cnt
FROM (
  SELECT
    cp.conversation_id,
    cp.user_id,
    COUNT(m.id)::int AS cnt
  FROM "conversation_participants" cp
  LEFT JOIN "messages" m ON m.conversation_id = cp.conversation_id
    AND m.sender_id <> cp.user_id
    AND m.kind = 'user'
    AND (
      cp.last_read_message_id IS NULL
      OR m.created_at > (
        SELECT created_at FROM "messages" WHERE id = cp.last_read_message_id
      )
    )
  GROUP BY cp.conversation_id, cp.user_id
) sub
WHERE cp.conversation_id = sub.conversation_id
  AND cp.user_id = sub.user_id;
