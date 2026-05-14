-- Migration 0010: add 'posthog' to the site_tags.kind enum.
--
-- Sister to the analytics layer landing this release. The
-- public-facing tags (analytics/gtm/facebook/clarity/tiktok/hotjar)
-- are pure script injection — those keep using TrackingTags on
-- the public layout. PostHog is different: the SDK needs an early
-- init() call with the project key so capture() calls fired by
-- the AnalyticsProvider land somewhere.
--
-- Today the project key reads from NEXT_PUBLIC_POSTHOG_KEY env;
-- making it ALSO admin-editable means the team can rotate keys
-- without a redeploy when needed. The TrackingTags / analytics
-- init paths read both sources, preferring env (faster boot, no
-- DB roundtrip) and falling back to the DB row.

DO $$ BEGIN
 ALTER TABLE "site_tags" DROP CONSTRAINT IF EXISTS "site_tags_kind_check";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_tags" ADD CONSTRAINT "site_tags_kind_check"
   CHECK ("kind" IN ('analytics','gtm','facebook','clarity','tiktok','hotjar','posthog'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
