-- Migration 0006: add fields required to support user-created groups.
--
-- `conversations.image_url`  — group avatar (user-uploaded). Null for
--                              DMs and system-named rooms.
-- `conversations.created_by` — owner of the group; FK to users.id with
--                              ON DELETE SET NULL so deleting a user
--                              leaves the room intact under a "former
--                              owner" state.
-- `conversation_participants.role` — owner / admin / member. Defaults
--                                    to 'member' for backfill safety.
--
-- All ALTERs are wrapped in DO $$ … EXCEPTION blocks so retries are
-- safe on environments that may have partially applied the migration
-- (same defensive pattern used in 0005).

DO $$ BEGIN
 ALTER TABLE "conversation_participants" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD COLUMN "image_url" text;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD COLUMN "created_by" uuid;
EXCEPTION
 WHEN duplicate_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
