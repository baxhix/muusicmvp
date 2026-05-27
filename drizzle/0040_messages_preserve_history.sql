-- P2.1 da auditoria de chat — preserva histórico de mensagens
-- quando um usuário é hard-deletado (LGPD).
--
-- Antes: `messages.sender_id` referenciava `users(id)` com
-- ON DELETE CASCADE. Em hard-delete final (após o período de
-- retenção do soft-delete), o cascade apagava TODAS as mensagens
-- do user — destrutivo demais pra histórico de DM/grupo onde a
-- outra parte ainda quer ver o que foi dito.
--
-- Depois: ON DELETE SET NULL no sender_id + nova coluna
-- `sender_deleted` boolean. Quando o user some, a mensagem fica
-- com senderId=NULL e a flag=true. Frontend renderiza como "Usuário
-- removido" no nome, mantendo o body intacto.
--
-- Operação:
--   1. Drop a FK existente (cascade).
--   2. Recria com ON DELETE SET NULL.
--   3. Permite sender_id NULL (era NOT NULL antes).
--   4. Adiciona sender_deleted boolean DEFAULT false.
--
-- Idempotente via IF EXISTS / IF NOT EXISTS.

-- Localiza e dropa a FK existente (o nome auto-gerado do drizzle
-- pode variar, mas em geral é "messages_sender_id_users_id_fk").
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'messages'
    AND con.contype = 'f'
    AND con.conkey @> ARRAY[
      (SELECT attnum FROM pg_attribute
        WHERE attrelid = rel.oid AND attname = 'sender_id')
    ];
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE messages DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- Permite NULL e recria FK com SET NULL.
ALTER TABLE "messages"
  ALTER COLUMN "sender_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "sender_deleted" boolean NOT NULL DEFAULT false;

ALTER TABLE "messages"
  ADD CONSTRAINT "messages_sender_id_users_id_fk"
  FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL;
