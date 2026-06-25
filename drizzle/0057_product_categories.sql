-- Categorias de produtos da Loja Fanverse + vínculo produto→categoria.
-- Idempotente: pode rodar onde tabela/coluna já existam.
CREATE TABLE IF NOT EXISTS "product_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "product_categories_order_idx"
  ON "product_categories" ("sort_order", "name");

-- Cada produto pode pertencer a UMA categoria (opcional). Apagar a
-- categoria não apaga o produto — só zera o vínculo (SET NULL).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category_id" uuid;

DO $$ BEGIN
  ALTER TABLE "products"
    ADD CONSTRAINT "products_category_id_product_categories_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
