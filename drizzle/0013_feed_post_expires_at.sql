-- Migration 0013: add `expires_at` to feed_posts for ephemeral
-- content (stories).
--
-- Stories are time-bound by definition — they vanish from the
-- public feed after a window (default 24h, set client-side by the
-- composer). Adding a dedicated column instead of stuffing it into
-- `payload` keeps the public listing query index-friendly:
--
--   WHERE status='published'
--     AND is_active=true
--     AND (expires_at IS NULL OR expires_at > now())
--
-- Image / video / carousel posts leave the column NULL (no expiry).
-- The same column could later anchor "limited-time sponsored
-- content" or campaign-bound posts without further DDL.

DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD COLUMN "expires_at" timestamp with time zone;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_posts_expires_at_idx"
  ON "feed_posts" USING btree ("expires_at");
