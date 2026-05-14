-- Migration 0007: feed comments + social interactions.
--
-- Three new tables plus three new notification kinds for the feed
-- comments system:
--
--   feed_posts            — canonical record of a post. Today posts
--                           live as mock data in FeedPanel.tsx; this
--                           table is the bridge that lets comments
--                           target them via a stable `post_key` slug.
--                           Lazy-inserted on first interaction so we
--                           don't have to seed the table when the
--                           mock array changes.
--
--   feed_comments         — comment OR reply on a post. Adjacency
--                           list: `parent_comment_id` points to the
--                           parent comment when this is a reply.
--                           Soft-delete via `deleted_at` so reply
--                           threads survive author/admin removal
--                           with a "Comentário removido" placeholder.
--
--   feed_comment_reactions — one row per (comment, user, emoji). MVP
--                           UI only fires ❤️ but schema is flexible
--                           so we can add more later without churn.
--
-- Notification enum gains `comment_reaction`, `comment_reply`,
-- `comment_mention` so the existing notifications fan-out can push
-- comment events through the same pipeline used today by chat
-- mentions and group_added. Two nullable FKs are added so the
-- notification row can deep-link to the specific post + comment.
--
-- All DDL is idempotent (CREATE … IF NOT EXISTS, DO $$ EXCEPTION
-- blocks) so retries on a partially-applied migration are safe —
-- same defensive pattern used in 0005 / 0006.

CREATE TABLE IF NOT EXISTS "feed_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  -- Stable client-side identifier. For mock posts we derive it from
  -- the post's first media src; for real posts (future) it'll be the
  -- post's own slug. Unique so the upsert path is deterministic.
  "post_key" text NOT NULL,
  -- Nullable: the mock "Central Ana Castela" posts have no owning
  -- user. Real user-authored posts (later) will set this.
  "author_user_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feed_posts_post_key_unique" UNIQUE ("post_key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feed_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid NOT NULL,
  -- Null for top-level comments; set for replies. Self-FK; no
  -- ON DELETE CASCADE so we can soft-delete the parent and keep
  -- the thread visible. Hard-deleting a parent (admin action) will
  -- explicitly cascade in app code.
  "parent_comment_id" uuid,
  "author_id" uuid NOT NULL,
  "body" text NOT NULL,
  -- Soft delete. UI renders "Comentário removido" in place of body
  -- when set, but the row stays so replies don't orphan.
  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_post_id_feed_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feed_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_parent_comment_id_feed_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."feed_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_comments_post_created_idx" ON "feed_comments" USING btree ("post_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_comments_parent_created_idx" ON "feed_comments" USING btree ("parent_comment_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_comments_author_idx" ON "feed_comments" USING btree ("author_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "feed_comment_reactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "comment_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "emoji" text DEFAULT '❤️' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feed_comment_reactions_unique" UNIQUE ("comment_id", "user_id", "emoji")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_comment_reactions" ADD CONSTRAINT "feed_comment_reactions_comment_id_feed_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."feed_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feed_comment_reactions" ADD CONSTRAINT "feed_comment_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feed_comment_reactions_comment_idx" ON "feed_comment_reactions" USING btree ("comment_id");--> statement-breakpoint

-- Notifications extension. `kind` is a CHECK-constrained text column
-- (drizzle's text({enum}) compiles to that). The original constraint
-- enumerated 6 kinds; we drop+re-add it so the three new comment
-- kinds become valid. Wrapped defensively so an env that already has
-- the new constraint doesn't fail.
DO $$ BEGIN
 ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_kind_check";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check"
   CHECK ("kind" IN (
     'same_track','same_artist','same_album',
     'message','mention','group_added',
     'comment_reaction','comment_reply','comment_mention'
   ));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD COLUMN "feed_post_id" uuid;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD COLUMN "comment_id" uuid;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_feed_post_id_feed_posts_id_fk" FOREIGN KEY ("feed_post_id") REFERENCES "public"."feed_posts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_feed_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."feed_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
