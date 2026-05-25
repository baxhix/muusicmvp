-- Configurações globais de marca aplicadas a todos os emails:
-- logo do header, rodapé com redes sociais, links institucionais.
--
-- Estrutura: tabela com 1 row só (singleton). O `id=1` é forçado
-- por CHECK pra evitar múltiplas linhas confundindo o admin.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS email_brand_settings (
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_by  uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Seed inicial — vazio. Admin preenche pelo painel.
INSERT INTO email_brand_settings (id, settings)
  VALUES (1, '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
