-- Tabelas pra gerenciamento de emails no admin:
--   email_templates  — subject/HTML editáveis (com fallback hardcoded)
--   email_logs       — audit trail de TODO envio (ok + falha)
--   email_campaigns  — broadcasts criados via admin
--
-- Idempotente (IF NOT EXISTS em tudo). Não há backfill nem seed
-- automático — templates aparecem vazios e o código cai pro
-- hardcoded até o admin criar a primeira versão editável.

CREATE TABLE IF NOT EXISTS email_templates (
  kind         text PRIMARY KEY,
  subject      text NOT NULL,
  html         text NOT NULL,
  is_active    boolean NOT NULL DEFAULT TRUE,
  description  text,
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_by   uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS email_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "to"           text NOT NULL,
  kind           text NOT NULL,
  subject        text NOT NULL,
  status         text NOT NULL,
  error_message  text,
  campaign_id    uuid,
  sent_at        timestamptz NOT NULL DEFAULT NOW(),
  duration_ms    integer
);

CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx  ON email_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_kind_idx     ON email_logs (kind);
CREATE INDEX IF NOT EXISTS email_logs_status_idx   ON email_logs (status);
CREATE INDEX IF NOT EXISTS email_logs_campaign_idx ON email_logs (campaign_id);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  subject           text NOT NULL,
  html              text NOT NULL,
  segment           text NOT NULL,
  segment_params    jsonb,
  status            text NOT NULL DEFAULT 'draft',
  scheduled_at      timestamptz,
  sent_count        integer NOT NULL DEFAULT 0,
  failed_count      integer NOT NULL DEFAULT 0,
  total_recipients  integer NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  completed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS email_campaigns_status_idx     ON email_campaigns (status);
CREATE INDEX IF NOT EXISTS email_campaigns_created_at_idx ON email_campaigns (created_at DESC);
