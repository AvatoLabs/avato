CREATE TABLE IF NOT EXISTS "upload_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text,
	"blob_id" text,
	"storage_key" text NOT NULL,
	"expected_size" integer NOT NULL,
	"expected_sha256" varchar(64),
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"etag" text,
	"created_by" text,
	"metadata" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "documents_client_id_space_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "documents_slug_space_id_unique";--> statement-breakpoint
ALTER TABLE "knowledge_base_files" ADD COLUMN IF NOT EXISTS "space_id" text;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "space_id" text;--> statement-breakpoint
UPDATE "knowledge_base_files" AS "kbf"
SET "space_id" = "kb"."space_id"
FROM "knowledge_bases" AS "kb"
WHERE "kbf"."knowledge_base_id" = "kb"."id"
  AND "kbf"."space_id" IS NULL
  AND "kb"."space_id" IS NOT NULL;--> statement-breakpoint
UPDATE "topics" AS "t"
SET "space_id" = "doc_space"."space_id"
FROM (
  SELECT DISTINCT ON ("td"."topic_id")
    "td"."topic_id",
    "d"."space_id"
  FROM "topic_documents" AS "td"
  INNER JOIN "documents" AS "d" ON "d"."id" = "td"."document_id"
  WHERE "d"."space_id" IS NOT NULL
  ORDER BY "td"."topic_id", "td"."created_at" DESC
) AS "doc_space"
WHERE "t"."id" = "doc_space"."topic_id"
  AND "t"."space_id" IS NULL;--> statement-breakpoint
ALTER TABLE "upload_sessions" DROP CONSTRAINT IF EXISTS "upload_sessions_space_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" DROP CONSTRAINT IF EXISTS "upload_sessions_blob_id_space_blobs_id_fk";--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_blob_id_space_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."space_blobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" DROP CONSTRAINT IF EXISTS "upload_sessions_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_space_id_idx" ON "upload_sessions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_blob_id_idx" ON "upload_sessions" USING btree ("blob_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_expires_at_idx" ON "upload_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "upload_sessions_status_idx" ON "upload_sessions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "knowledge_base_files" DROP CONSTRAINT IF EXISTS "knowledge_base_files_space_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "knowledge_base_files" ADD CONSTRAINT "knowledge_base_files_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" DROP CONSTRAINT IF EXISTS "topics_space_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kbf_space_id_idx" ON "knowledge_base_files" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topics_space_id_idx" ON "topics" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_client_id_space_id_unique" ON "documents" USING btree ("client_id","space_id") WHERE ("documents"."client_id" is not null and "documents"."deleted_at" is null);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "documents_slug_space_id_unique" ON "documents" USING btree ("slug","space_id") WHERE ("documents"."slug" is not null and "documents"."deleted_at" is null);--> statement-breakpoint
ALTER TABLE "knowledge_bases" DROP COLUMN IF EXISTS "is_public";
