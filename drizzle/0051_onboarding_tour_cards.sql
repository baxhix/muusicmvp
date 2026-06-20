-- Onboarding tour cards — os passos do tour de orientação in-app
-- (deck animado mostrado ao usuário no /app). CRUD vive em
-- /admin/onboarding; o app consome os publicados via
-- GET /api/onboarding-tour. Substitui o DEFAULT_ONBOARDING_TOUR
-- estático (que permanece como fallback no cliente).
--
-- Esquema:
--   id            uuid primary key (defaultRandom no app)
--   emoji         text (opcional — emoji acima do título)
--   title         text not null (suporta \n pra quebra de linha)
--   body          text not null (suporta \n)
--   cta           text not null (texto do botão primário)
--   decor         text (null | 'globe' — decoração de bolhas)
--   anchor        text (reservado — chave de spotlight ancorado)
--   sort_order    int  not null default 0 (menor = aparece primeiro)
--   published_at  timestamptz (null = rascunho; non-null = publicado)
--   created_at/updated_at timestamptz not null default now()
--   created_by/updated_by uuid → users(id) ON DELETE SET NULL
--
-- Index (sort_order, created_at) acelera o SELECT do app que ordena
-- por sort_order asc e desempata por data de criação.

CREATE TABLE IF NOT EXISTS "onboarding_tour_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "emoji" text,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "cta" text NOT NULL,
  "decor" text,
  "anchor" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid
);

DO $$ BEGIN
  ALTER TABLE "onboarding_tour_cards"
    ADD CONSTRAINT "onboarding_tour_cards_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "onboarding_tour_cards"
    ADD CONSTRAINT "onboarding_tour_cards_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "onboarding_tour_cards_order_idx"
  ON "onboarding_tour_cards" ("sort_order", "created_at");

-- Seed dos 4 cards default do tour (publicados), pra continuidade
-- com o conteúdo que já vivia no DEFAULT_ONBOARDING_TOUR. Só roda
-- quando a tabela está vazia (idempotente em re-execuções).
INSERT INTO "onboarding_tour_cards"
  ("emoji", "title", "body", "cta", "decor", "anchor", "sort_order", "published_at")
SELECT * FROM (VALUES
  ('🪙', E'Cada ação rende\nFanpoints', 'Ouvir música, curtir, conversar — tudo conta. Acumule pra desbloquear conquistas exclusivas da Boiadeira.', 'Próximo', NULL, 'fanpoints', 0, now()),
  ('🔮', E'Conecte com\noutros fãs', 'Use o Chat pra falar direto com alguém e Comunidades pra debater com a galera toda.', 'Próximo', NULL, 'chat', 1, now()),
  (NULL, E'Encontre fãs\npelo mundo', 'Cada ponto no globo é um fã ao vivo. Gire, explore e descubra quem tá ouvindo a Boiadeira com você agora.', 'Próximo', 'globe', 'globe', 2, now()),
  ('👑', E'Suba no ranking\ndos Superfãs', 'Quem acumula mais Fanpoints vira destaque na comunidade — com badges, posição no top e benefícios exclusivos.', 'Concluir', NULL, 'ranking', 3, now())
) AS seed("emoji", "title", "body", "cta", "decor", "anchor", "sort_order", "published_at")
WHERE NOT EXISTS (SELECT 1 FROM "onboarding_tour_cards");
