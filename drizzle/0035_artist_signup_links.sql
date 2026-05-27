-- 0035 — artist signup links (Aquisição CRUD)
--
-- Tabela `artist_signup_links`: cada row é um link único
-- (`/r/{slug}`) que um artista compartilha nas redes pra atrair
-- signups. Coluna `users.signup_link_id` atribui cada user novo
-- ao link que o trouxe (lido do cookie `fanverse_ref` no momento
-- da criação do user row).
--
-- Sem dados iniciais — os links são criados sob demanda no
-- /admin/aquisicao quando o time decide ativar uma campanha.

CREATE TABLE IF NOT EXISTS "artist_signup_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "slug" text NOT NULL UNIQUE,
    "artist_name" text NOT NULL,
    "label" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
    "archived_at" timestamp with time zone
);

-- Índices úteis pro listing admin (ordenado por created_at desc)
-- + lookup por slug no /r/[slug].
CREATE INDEX IF NOT EXISTS "artist_signup_links_created_at_idx"
    ON "artist_signup_links" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "artist_signup_links_archived_idx"
    ON "artist_signup_links" ("archived_at")
    WHERE "archived_at" IS NULL;

-- Adiciona signup_link_id em users com FK SET NULL. Setado no
-- INSERT do user row pelo backend (lendo o cookie fanverse_ref).
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "signup_link_id" uuid
    REFERENCES "artist_signup_links"("id") ON DELETE SET NULL;

-- Índice pra acelerar a query "users do link X" no detail page
-- do admin (/admin/aquisicao/[id]).
CREATE INDEX IF NOT EXISTS "users_signup_link_id_idx"
    ON "users" ("signup_link_id")
    WHERE "signup_link_id" IS NOT NULL;
