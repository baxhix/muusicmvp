-- Migration 0045: add 'youtube_video' to feed_posts.type CHECK constraint.
--
-- Bug fix: tentar publicar um post `youtube_video` falhava com erro
-- genérico "Tente novamente em instantes" porque o CHECK constraint
-- introduzido em 0016 não conhecia o novo type — o INSERT batia em
-- check_violation e o catch da route mapeava pra 500.
--
-- Esse patch dropa o constraint antigo e recria incluindo o
-- 'youtube_video'. Idempotente via DO/EXCEPTION pra que migrar
-- ambiente que já está OK seja no-op.

DO $$ BEGIN
 ALTER TABLE "feed_posts" DROP CONSTRAINT IF EXISTS "feed_posts_type_check";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_type_check"
   CHECK ("type" IN ('image','video','carousel','story','poll','sponsored','broadcast','audio','youtube_video'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
