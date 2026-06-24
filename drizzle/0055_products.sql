-- Produtos da Loja Fanverse (admin → Produtos).
-- Idempotente: pode rodar onde a tabela já exista.
CREATE TABLE IF NOT EXISTS "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price_from" integer,
  "price_to" integer DEFAULT 0 NOT NULL,
  "image_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "audience" text DEFAULT 'all' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_by_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "products"
    ADD CONSTRAINT "products_created_by_id_users_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "products_order_idx" ON "products" ("sort_order", "created_at");
