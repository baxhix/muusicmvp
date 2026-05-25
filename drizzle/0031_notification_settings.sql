-- Catálogo gerenciável de notificações: cada `kind` (slug estável
-- usado em código) tem um row com toggle on/off + por-canal
-- (in_app, email). O catálogo de tipos vive em código (igual ao
-- KNOWN_TEMPLATES); esta tabela só persiste as escolhas do admin.
--
-- Tipos não persistidos caem pros defaults definidos no catálogo
-- (enabled = true, channels = defaultChannels).
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS notification_settings (
  kind        text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT TRUE,
  /* JSON com flag por canal: {"in_app": true, "email": false}.
   * Canais desconhecidos são ignorados pelo runtime. */
  channels    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL
);
