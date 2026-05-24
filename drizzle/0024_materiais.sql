-- ============================================================
-- 0024_materiais: acervo hierárquico de materiais exclusivos
-- ============================================================
-- Modela o "Drive da artista" no admin: árvore de pastas e
-- arquivos com tier de audiência (Top 1/10/50/100/Todos),
-- vinculados a um usuário admin que criou o registro. O binário
-- vive no filesystem (uploads/materiais/); aqui ficam só os
-- metadados + URLs.
--
-- Self-referencing FK em parent_id com cascade simplifica
-- exclusão: apagar uma pasta limpa todos os descendentes
-- automaticamente. O código de aplicação ainda precisa coletar
-- os filenames antes pra remover os binários do disco.
-- ============================================================

CREATE TABLE IF NOT EXISTS "material_nodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text NOT NULL CHECK ("type" IN ('folder', 'file')),
  "name" text NOT NULL,
  "parent_id" uuid REFERENCES "material_nodes"("id") ON DELETE CASCADE,
  "description" text,

  -- Campos só de file (NULL pra folders).
  "formato" text CHECK ("formato" IS NULL OR "formato" IN ('jpg','png','svg','mp3','mp4','pdf','zip')),
  "file_url" text,
  "thumb_url" text,
  "filename" text,
  "tamanho_bytes" integer,
  "status" text DEFAULT 'publicado' CHECK ("status" IS NULL OR "status" IN ('rascunho','publicado','agendado','arquivado')),
  "publicado_em" timestamp with time zone,
  "published_to_feed" boolean NOT NULL DEFAULT false,
  "downloads" integer NOT NULL DEFAULT 0,
  "favoritos" integer NOT NULL DEFAULT 0,
  "audience" text DEFAULT 'all' CHECK ("audience" IS NULL OR "audience" IN ('top1','top10','top50','top100','all')),

  "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "material_nodes_parent_idx" ON "material_nodes"("parent_id");
CREATE INDEX IF NOT EXISTS "material_nodes_type_idx" ON "material_nodes"("type");

-- ── Seed: 6 categorias raiz pra que a feature já apareça
--    populada no admin do primeiro acesso. Idempotente — usa
--    NOT EXISTS pra não duplicar em re-runs.
INSERT INTO "material_nodes" ("type", "name", "description", "parent_id")
SELECT * FROM (VALUES
  ('folder'::text, 'Álbuns de fotos'::text,    'Registros bastidores + palco das turnês.'::text,                  NULL::uuid),
  ('folder',       'Álbuns exclusivos',        'Versões alternativas, demos e gravações privadas.',               NULL),
  ('folder',       'Wallpapers',               'Mobile + desktop em alta resolução.',                             NULL),
  ('folder',       'Figurinhas',               'Stickers para WhatsApp e Telegram.',                              NULL),
  ('folder',       'Templates',                'Stories, posts e capas para os fãs personalizarem.',              NULL),
  ('folder',       'Logotipos',                'Marca oficial em SVG e PNG, variantes light/dark.',               NULL)
) AS seed("type", "name", "description", "parent_id")
WHERE NOT EXISTS (
  SELECT 1 FROM "material_nodes" WHERE "parent_id" IS NULL AND "type" = 'folder'
);
