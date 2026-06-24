-- Comentários por faixa/música. Cada usuário pode comentar sobre uma
-- música específica (tema = a música), e os likes da faixa já existem
-- na tabela `track_likes`. Tabela flat (sem replies) — discussão por
-- música. Soft-delete via `deleted_at`. Idempotente.

CREATE TABLE IF NOT EXISTS "track_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "track_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "body" text NOT NULL,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "track_comments"
    ADD CONSTRAINT "track_comments_track_id_tracks_id_fk"
    FOREIGN KEY ("track_id") REFERENCES "tracks"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "track_comments"
    ADD CONSTRAINT "track_comments_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "track_comments_track_created_idx"
  ON "track_comments" ("track_id", "created_at");
CREATE INDEX IF NOT EXISTS "track_comments_author_idx"
  ON "track_comments" ("author_id");
