-- Migration 0047: add 'material_alert' to feed_posts.type CHECK constraint.
--
-- Novo tipo de post usado quando a Central de Fãs libera material
-- exclusivo na aba Materiais do box Fanverse Ana Castela. Mesmo
-- padrão de extensão usado pela migration 0045 (youtube_video).
-- Idempotente via DO/EXCEPTION.

DO $$ BEGIN
 ALTER TABLE "feed_posts" DROP CONSTRAINT IF EXISTS "feed_posts_type_check";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_type_check"
   CHECK ("type" IN ('image','video','carousel','story','poll','sponsored','broadcast','audio','youtube_video','material_alert'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
