-- Adds a `kind` discriminator to messages so we can interleave
-- system events (group created, member joined, member renamed group,
-- etc.) with user-typed messages in the same timeline.
--
-- `kind='user'` covers every row up to now and is the default for
-- inserts that don't specify, so existing send paths keep working.
--
-- Indexed messages query already filters by conversation_id + ordered
-- by created_at — no new index needed for now; system-event rows are
-- rare compared to user messages and the planner walks the same path.

ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'user';
