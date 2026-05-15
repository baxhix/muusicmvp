-- Migration 0016: add 'audio' to feed_posts.type CHECK constraint.
--
-- The composer in /admin/feed now exposes "Áudio" as a media kind
-- alongside Imagem / Vídeo / Story. Until the public-side audio
-- renderer ships, the post stores like an image post (cover art
-- in `media[]`); the type flag persists so future renderers can
-- light up native audio playback without a separate DDL pass.

DO $$ BEGIN
 ALTER TABLE "feed_posts" DROP CONSTRAINT IF EXISTS "feed_posts_type_check";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_type_check"
   CHECK ("type" IN ('image','video','carousel','story','poll','sponsored','broadcast','audio'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
