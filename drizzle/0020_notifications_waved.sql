-- Migration 0020: Add 'waved' to the notifications.kind CHECK constraint
--
-- Migration 0007 added a Postgres CHECK that restricts kind to a
-- closed set of strings. The new `'waved'` value (heart-wave
-- notification) was not in that list, so inserts from the new
-- `wave:send` realtime handler were rejected by the constraint —
-- the handler caught the error silently, ack'd `send_failed` to
-- the sender's socket, and the receiver never got a notify:new
-- (their hearts cascade never fired).
--
-- This migration drops + re-adds the constraint with the expanded
-- enum that matches the current `notifications.kind` enum in
-- src/server/db/schema.ts.

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
     'comment_reaction','comment_reply','comment_mention',
     'waved'
   ));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
