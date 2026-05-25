-- Marker pra disparar boas-vindas uma única vez.
--
-- Setado pelo /api/auth/onboarding logo após persistir o
-- is_onboarded=true. Próximo trigger do mesmo fluxo (se houver)
-- não reenvia, garantindo idempotência mesmo se o frontend
-- chamar onboarding 2x por race condition de network.
--
-- Idempotente.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;
