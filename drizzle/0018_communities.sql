-- Migration 0018: Communities (forum-style)
--
-- Adds the four tables that power the /app "Comunidade" surface:
--
--   communities             — top-level community rows
--   community_members       — membership join table (PK = community_id + user_id)
--   community_topics        — threads inside a community
--   community_topic_comments — comments + 1-level replies on a topic
--
-- See `src/server/db/schema.ts` for the matching Drizzle table
-- definitions + docs on each column.

CREATE TABLE IF NOT EXISTS "communities" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"             text NOT NULL UNIQUE,
  "name"             text NOT NULL,
  "description"      text,
  "image_url"        text,
  "creator_id"       uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "member_count"     integer NOT NULL DEFAULT 1,
  "topic_count"      integer NOT NULL DEFAULT 0,
  "last_activity_at" timestamp WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "created_at"       timestamp WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at"       timestamp WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "communities_creator_idx"
  ON "communities" ("creator_id");
CREATE INDEX IF NOT EXISTS "communities_activity_idx"
  ON "communities" ("last_activity_at");

CREATE TABLE IF NOT EXISTS "community_members" (
  "community_id" uuid NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "joined_at"    timestamp WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("community_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "community_members_user_idx"
  ON "community_members" ("user_id");

CREATE TABLE IF NOT EXISTS "community_topics" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "community_id"  uuid NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
  "author_id"     uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "title"         text NOT NULL,
  "body"          text,
  "comment_count" integer NOT NULL DEFAULT 0,
  "deleted_at"    timestamp WITH TIME ZONE,
  "created_at"    timestamp WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updated_at"    timestamp WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "community_topics_community_idx"
  ON "community_topics" ("community_id", "created_at");
CREATE INDEX IF NOT EXISTS "community_topics_author_idx"
  ON "community_topics" ("author_id");

CREATE TABLE IF NOT EXISTS "community_topic_comments" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "topic_id"          uuid NOT NULL REFERENCES "community_topics"("id") ON DELETE CASCADE,
  "parent_comment_id" uuid REFERENCES "community_topic_comments"("id") ON DELETE CASCADE,
  "author_id"         uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "body"              text NOT NULL,
  "deleted_at"        timestamp WITH TIME ZONE,
  "created_at"        timestamp WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "community_topic_comments_topic_idx"
  ON "community_topic_comments" ("topic_id", "created_at");
CREATE INDEX IF NOT EXISTS "community_topic_comments_parent_idx"
  ON "community_topic_comments" ("parent_comment_id");
