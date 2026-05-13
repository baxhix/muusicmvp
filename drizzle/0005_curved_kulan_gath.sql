-- Migration 0005: add `reports` table for user-submitted denuncias.
--
-- The drizzle-kit generate output originally tried to re-create
-- `message_reactions` here as well — that table was added by a
-- hand-written migration (0004_message_reactions.sql) that didn't
-- update the snapshot drizzle-kit reads, so kit saw the table as
-- "new" when comparing schemas. Recreating it failed on production
-- (relation already exists), which aborted the whole migration and
-- left `reports` unbuilt → POST /api/reports → 500.
--
-- Trimmed back to just the reports DDL. `CREATE TABLE IF NOT EXISTS`
-- keeps a retry safe on any environment that may have partially
-- applied the original 0005.

CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"description" text,
	"image_url" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_created_at_idx" ON "reports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reports_target_user_id_idx" ON "reports" USING btree ("target_user_id");
