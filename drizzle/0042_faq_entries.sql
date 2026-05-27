-- FAQ entries — perguntas e respostas que aparecem na seção FAQ
-- pública do site. CRUD vive em /admin/site/faq.
--
-- Esquema:
--   id            uuid primary key (defaultRandom no app)
--   question      text not null
--   answer        text not null
--   category      text (opcional — texto livre por enquanto)
--   sort_order    int  not null default 0 (menor = aparece primeiro)
--   published_at  timestamptz (null = rascunho; non-null = publicado)
--   created_at    timestamptz not null default now()
--   updated_at    timestamptz not null default now()
--   created_by    uuid → users(id) ON DELETE SET NULL
--   updated_by    uuid → users(id) ON DELETE SET NULL
--
-- Index `faq_entries_order_idx` (sort_order, created_at) acelera o
-- SELECT do site público que ordena por sort_order asc e desempata
-- por data de criação.

CREATE TABLE IF NOT EXISTS "faq_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "category" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid,
  "updated_by" uuid
);

DO $$ BEGIN
  ALTER TABLE "faq_entries"
    ADD CONSTRAINT "faq_entries_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "faq_entries"
    ADD CONSTRAINT "faq_entries_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "faq_entries_order_idx"
  ON "faq_entries" ("sort_order", "created_at");
