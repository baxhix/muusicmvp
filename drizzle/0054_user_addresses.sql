-- Endereços de entrega da Loja Fanverse (Meus dados).
-- Idempotente: pode rodar em ambiente onde a tabela já exista.
CREATE TABLE IF NOT EXISTS "user_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "recipient" text NOT NULL,
  "cep" text NOT NULL,
  "street" text NOT NULL,
  "number" text NOT NULL,
  "complement" text,
  "district" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "country" text DEFAULT 'Brasil' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "user_addresses"
    ADD CONSTRAINT "user_addresses_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "user_addresses_user_idx" ON "user_addresses" ("user_id");
