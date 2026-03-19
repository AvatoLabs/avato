-- Rename session_tags to tags (topic-level tags only, remove session-level trace)
ALTER TABLE IF EXISTS "session_tags" RENAME TO "tags";
--> statement-breakpoint
ALTER TABLE "topics" DROP CONSTRAINT IF EXISTS "topics_tag_id_session_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_tag_id_tags_id_fk"
  FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER INDEX IF EXISTS "session_tags_client_id_user_id_unique" RENAME TO "tags_client_id_user_id_unique";
--> statement-breakpoint
ALTER INDEX IF EXISTS "session_tags_user_id_idx" RENAME TO "tags_user_id_idx";
--> statement-breakpoint
ALTER TABLE "tags" RENAME CONSTRAINT "session_tags_user_id_users_id_fk" TO "tags_user_id_users_id_fk";