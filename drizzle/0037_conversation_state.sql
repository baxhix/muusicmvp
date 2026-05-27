-- Conversa por participante: dois marcadores temporais novos
-- ────────────────────────────────────────────────────────
--   left_at:    quando o usuário saiu do grupo (ou foi kickado).
--               Substitui o hard-delete do row — agora o histórico
--               do user fica visível pra ele em modo read-only.
--               Lê o grupo, vê "Você saiu", mas NÃO posta mais.
--               Re-add (addMember) limpa este campo de volta pra NULL.
--
--   hidden_at:  "Apagar conversa pra mim" — user some a conversa
--               da sua lista sem afetar a outra parte. Em DMs, se
--               a outra pessoa mandar uma mensagem nova,
--               COALESCE(hidden_at, '-infinity') < last_msg.created_at
--               faz a conversa voltar a aparecer.
--
-- Ambos opcionais (default NULL = comportamento atual).

ALTER TABLE "conversation_participants"
  ADD COLUMN IF NOT EXISTS "left_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "hidden_at" timestamptz;
