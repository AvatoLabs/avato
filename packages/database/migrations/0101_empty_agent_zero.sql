-- Add missing columns to upload_sessions (0097 created the table without these)
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "blob_id" text;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "accessed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_blob_id_space_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."space_blobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_blob_id_idx" ON "upload_sessions" USING btree ("blob_id");--> statement-breakpoint
-- Add FK for knowledge_base_files.space_id (0098 added column+index but no FK)
ALTER TABLE "knowledge_base_files" ADD CONSTRAINT "knowledge_base_files_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Drop deprecated column
ALTER TABLE "knowledge_bases" DROP COLUMN IF EXISTS "is_public";