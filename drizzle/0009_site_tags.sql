-- Migration 0009: site_tags table for managing third-party
-- tracking/analytics snippets (Google Analytics, Google Tag
-- Manager, Facebook Pixel, Microsoft Clarity, TikTok Pixel,
-- Hotjar). Edited from the admin Settings → Tags tab, read
-- server-side by the public layout to inject each enabled tag.
--
-- One row per `kind` (the natural key). Storing the kind as a PK
-- text keeps lookups + upserts trivial — there's only ever ONE
-- analytics tag at a time. CHECK constraint lists every kind we
-- recognize; adding a new kind = ALTER the constraint + render a
-- new snippet in the TrackingTags component.
--
-- `value` is the public ID/measurement code (G-XXXX, GTM-XXXX,
-- numeric FB pixel id, clarity tag id, …). `enabled=false` keeps
-- the row's value around while pausing the tag — handy when the
-- team wants to A/B between two pixels without losing the
-- previous one.

CREATE TABLE IF NOT EXISTS "site_tags" (
  "kind" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL DEFAULT '',
  "enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by_id" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_tags" ADD CONSTRAINT "site_tags_updated_by_id_users_id_fk"
   FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_tags" ADD CONSTRAINT "site_tags_kind_check"
   CHECK ("kind" IN ('analytics','gtm','facebook','clarity','tiktok','hotjar'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Seed: bring the currently-hardcoded GA tag (G-2PG52R6WPE)
-- into the table so the new DB-driven loader replaces it 1:1
-- on first deploy with no analytics gap.
INSERT INTO "site_tags" ("kind", "value", "enabled")
VALUES ('analytics', 'G-2PG52R6WPE', true)
ON CONFLICT ("kind") DO NOTHING;
