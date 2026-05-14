-- Migration 0008: turn `feed_posts` into a real CMS-backed table.
--
-- Background: 0007 created `feed_posts` as a lightweight bridge so
-- comments could attach to mock posts (keyed by a derived `post_key`).
-- The Central Ana Castela team now needs to author + schedule real
-- posts from the admin panel, so we extend the same table with the
-- CMS fields rather than spinning up a parallel one. That keeps the
-- comments / reactions / notifications wiring 1:1 with admin posts.
--
-- New columns are all nullable (or have defaults) so existing
-- mock-keyed rows survive — they sit with type=null/status=null and
-- are simply ignored by the public listing query (which filters on
-- status='published' + is_active + published_at<=now).
--
-- Future formats (video / story / poll / sponsored / broadcast) ride
-- on the same `type` column — the CHECK constraint lists them all
-- ahead of time so no schema churn is needed when the UI flips them
-- on.
--
-- `media` is a jsonb array of { url, alt? } so a single post can carry
-- multiple images for carousel rendering. Keeping it as jsonb (not a
-- separate `feed_media` table) avoids a join on the hot read path
-- (public feed listing) — the cardinality per post is small (<= ~12)
-- and ordering is preserved by array index.

-- Make post_key nullable: admin-authored posts don't need the
-- client-derived bridge key the mock posts use. Existing rows keep
-- their key — we only allow new rows to skip it.
DO $$ BEGIN
 ALTER TABLE "feed_posts" ALTER COLUMN "post_key" DROP NOT NULL;
EXCEPTION
 WHEN others THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "type" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "status" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "title" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "description" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "media" jsonb;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "scheduled_at" timestamp with time zone;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "published_at" timestamp with time zone;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint

-- Constrain `type` to the supported formats. CMS UI today only flips
-- 'image' on; future toggles enable the others without DDL changes.
DO $$ BEGIN
 ALTER TABLE "feed_posts" DROP CONSTRAINT IF EXISTS "feed_posts_type_check";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_type_check"
   CHECK ("type" IS NULL OR "type" IN (
     'image','video','carousel','story','poll','sponsored','broadcast'
   ));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Constrain `status` to the four lifecycle states.
DO $$ BEGIN
 ALTER TABLE "feed_posts" DROP CONSTRAINT IF EXISTS "feed_posts_status_check";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_status_check"
   CHECK ("status" IS NULL OR "status" IN (
     'published','scheduled','draft','inactive'
   ));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Hot-path indexes:
--   * Public feed: WHERE status='published' AND is_active ORDER BY published_at DESC
--   * Admin listing: WHERE status=? ORDER BY updated_at DESC
--   * Scheduled-publish sweeper (future cron): WHERE status='scheduled' AND scheduled_at <= now()
CREATE INDEX IF NOT EXISTS "feed_posts_status_published_idx"
  ON "feed_posts" USING btree ("status", "published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_posts_status_scheduled_idx"
  ON "feed_posts" USING btree ("status", "scheduled_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_posts_status_updated_idx"
  ON "feed_posts" USING btree ("status", "updated_at");
