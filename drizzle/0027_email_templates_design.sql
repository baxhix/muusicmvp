-- Adiciona coluna `design` em email_templates pra guardar a
-- estrutura JSON do editor visual.
--
-- Quem edita visualmente grava `design` (JSONB) + o `html`
-- regenerado deterministicamente. Quem edita HTML direto grava
-- só `html` e zera `design` (não tem round-trip HTML→JSON
-- confiável). Esse esquema permite que o admin volte a editar
-- visualmente se tiver design salvo, ou força o modo HTML
-- quando não tem.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. Safe pra rodar.

ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS design jsonb;
