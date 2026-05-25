-- Anti-spam pro cron de interações em comunidades. Cada email
-- registrado aqui — gate de cooldown evita reenvio pra (user_id,
-- community_id) que já recebeu nas últimas N horas.
--
-- Schema enxuto: id PK uuid, user FK + community FK (ambos
-- ON DELETE CASCADE pra que cleanup automático rode quando o
-- user é hard-deleted ou a comunidade é apagada), reason text
-- ('reply' | 'reaction' | 'viral') pra auditoria, sent_at
-- timestamptz pra calcular cooldown.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT
-- EXISTS — rodar 2x não quebra.

CREATE TABLE IF NOT EXISTS community_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  reason text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cnl_user_sent_idx
  ON community_notification_log (user_id, sent_at);

CREATE INDEX IF NOT EXISTS cnl_user_community_idx
  ON community_notification_log (user_id, community_id, sent_at);
