-- Permite admin editar label/description/trigger por kind. Campos
-- null caem pro default definido em KNOWN_NOTIFICATIONS no código.
-- Idempotente.

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS label_override       text,
  ADD COLUMN IF NOT EXISTS description_override text,
  ADD COLUMN IF NOT EXISTS trigger_override     text;
