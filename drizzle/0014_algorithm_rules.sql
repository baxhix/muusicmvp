-- Migration 0014: algorithm_rules — admin-managed IF/THEN
-- behaviour catalog.
--
-- Each row describes a single platform behaviour: "when X happens
-- in user context Y, the platform should do Z". The CMS in
-- /admin/algoritmo registers these for future runtime evaluation +
-- internal documentation. Phase 1 (this release) is registration-
-- only — the player-side engine that consumes these rules is a
-- follow-up.
--
-- Schema notes:
--   - trigger_event + action_kind are closed enums enforced by
--     CHECK constraints. New entries get a follow-up migration so
--     we never silently accept a rule that the engine can't run.
--   - trigger_config / action_config are jsonb because each kind
--     has its own bag of parameters (idle seconds, screen names,
--     toast copy, etc.) — keeping them flexible avoids one column
--     per parameter type.
--   - service_name + target_object + tags are documentation fields
--     that surface in the listing UI and help the team navigate
--     the catalog as it grows.

CREATE TABLE IF NOT EXISTS "algorithm_rules" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                 text NOT NULL,
  "description"          text NOT NULL,
  "trigger_event"        text NOT NULL,
  "trigger_config"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  "action_kind"          text NOT NULL,
  "action_config"        jsonb NOT NULL DEFAULT '{}'::jsonb,
  "service_name"         text,
  "target_object"        text,
  "tags"                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  "documentation_url"    text,
  "enabled"              boolean NOT NULL DEFAULT false,
  "priority"             integer NOT NULL DEFAULT 100,
  "cooldown_seconds"     integer NOT NULL DEFAULT 0,
  "max_per_session"      integer NOT NULL DEFAULT 0,
  "created_by_user_id"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT "algorithm_rules_trigger_event_check" CHECK (
    "trigger_event" IN (
      'session_started',
      'idle_in_screen',
      'feed_scroll_streak',
      'track_completed',
      'track_skipped',
      'time_in_app_minutes',
      'consecutive_inactive_days'
    )
  ),
  CONSTRAINT "algorithm_rules_action_kind_check" CHECK (
    "action_kind" IN (
      'show_toast',
      'nudge_to_screen',
      'inject_recommendation',
      'show_modal'
    )
  ),
  CONSTRAINT "algorithm_rules_priority_check"        CHECK ("priority"         >= 0),
  CONSTRAINT "algorithm_rules_cooldown_seconds_check" CHECK ("cooldown_seconds" >= 0),
  CONSTRAINT "algorithm_rules_max_per_session_check"  CHECK ("max_per_session"  >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "algorithm_rules_enabled_idx"
  ON "algorithm_rules" USING btree ("enabled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "algorithm_rules_trigger_event_idx"
  ON "algorithm_rules" USING btree ("trigger_event");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "algorithm_rules_service_name_idx"
  ON "algorithm_rules" USING btree ("service_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "algorithm_rules_updated_at_idx"
  ON "algorithm_rules" USING btree ("updated_at" DESC);
