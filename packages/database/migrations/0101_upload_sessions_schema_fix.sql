ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "blob_id" text;
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "accessed_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "upload_sessions" ALTER COLUMN "created_at" SET DEFAULT now();
ALTER TABLE "upload_sessions" ALTER COLUMN "updated_at" SET DEFAULT now();

UPDATE "upload_sessions"
SET "created_at" = now()
WHERE "created_at" IS NULL;

UPDATE "upload_sessions"
SET "updated_at" = now()
WHERE "updated_at" IS NULL;

ALTER TABLE "upload_sessions" ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "upload_sessions" ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "upload_sessions" DROP CONSTRAINT IF EXISTS "upload_sessions_blob_id_space_blobs_id_fk";
ALTER TABLE "upload_sessions"
ADD CONSTRAINT "upload_sessions_blob_id_space_blobs_id_fk"
FOREIGN KEY ("blob_id") REFERENCES "public"."space_blobs"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "upload_sessions_blob_id_idx" ON "upload_sessions" USING btree ("blob_id");
