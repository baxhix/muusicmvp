-- Adiciona coluna `label` em email_templates pra o admin renomear
-- o template (nome amigável usado na UI). Default fica null —
-- nesse caso o GET cai pro label do KNOWN_TEMPLATES ou pro
-- próprio `kind` (orphan customizados).
--
-- Idempotente.

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS label text;
