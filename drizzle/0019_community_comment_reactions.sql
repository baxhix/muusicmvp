-- Migration 0019: Reactions on community topic comments
--
-- Mirrors `feed_comment_reactions` so the forum threads can show
-- ❤️ counts + the "I reacted" flag with the same shape the public
-- feed already uses. One row per (comment, user, emoji); the unique
-- constraint keeps the toggle idempotent on retries.

CREATE TABLE IF NOT EXISTS "community_topic_comment_reactions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "comment_id" uuid NOT NULL REFERENCES "community_topic_comments"("id") ON DELETE CASCADE,
  "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emoji"      text NOT NULL DEFAULT '❤️',
  "created_at" timestamp WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT "community_topic_comment_reactions_unique"
    UNIQUE ("comment_id", "user_id", "emoji")
);

CREATE INDEX IF NOT EXISTS "community_topic_comment_reactions_comment_idx"
  ON "community_topic_comment_reactions" ("comment_id");
