CREATE TABLE "track_likes" (
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "track_likes_user_id_track_id_pk" PRIMARY KEY("user_id","track_id")
);
--> statement-breakpoint
ALTER TABLE "track_likes" ADD CONSTRAINT "track_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "track_likes" ADD CONSTRAINT "track_likes_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "track_likes_user_created_idx" ON "track_likes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "track_likes_track_idx" ON "track_likes" USING btree ("track_id");