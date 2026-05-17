-- Migration 0010: engagement-rewards expansion of user_activities.
--
-- Extends the `kind` enum with four new reward kinds covering the
-- product spec for engagement-driven Fanpoints awards:
--
--   post_liked      — heart toggled ON on a feed post (chapéu) → 5 FP
--   comment_posted  — top-level comment OR reply created       → 10 FP
--   post_shared     — share/send arrow on a feed post          → 15 FP
--   three_streams   — bonus when stream count hits multiple of 3 → 10 FP
--
-- Also adds `post_id` as an optional FK to feed_posts so reward
-- rows for the feed-post-related kinds (post_liked / comment_posted
-- / post_shared) can be audited back to the post that triggered
-- them, without needing a separate junction table.
--
-- Note: existing `stream` rows keep their historical 100-pt values
-- (the column stores the points at insert time). Going forward
-- new `stream` rows persist with 0 points and the 10-pt reward
-- comes from the new `three_streams` row that gets inserted every
-- 3rd stream. See `src/server/listening/queries.ts` for the
-- milestone logic.

-- Drop the existing CHECK so we can re-add it with the new enum
-- values. The column type stays `text`.
ALTER TABLE "user_activities"
  DROP CONSTRAINT IF EXISTS "user_activities_kind_check";

ALTER TABLE "user_activities"
  ADD CONSTRAINT "user_activities_kind_check"
    CHECK (kind IN (
      'stream',
      'login',
      'chat_started',
      'post_liked',
      'comment_posted',
      'post_shared',
      'three_streams'
    ));

ALTER TABLE "user_activities"
  ADD COLUMN "post_id" uuid REFERENCES "feed_posts"("id") ON DELETE SET NULL;

-- Helpful index for "show me the activity feed for THIS post"
-- queries — admin / debugging surfaces can pull liked/commented/
-- shared rows in one indexed lookup.
CREATE INDEX IF NOT EXISTS "user_activities_post_idx"
  ON "user_activities" ("post_id");
