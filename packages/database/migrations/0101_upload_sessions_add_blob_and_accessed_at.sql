-- Custom SQL migration file, put your code below! --
-- Drizzle schema (resource.ts) includes blob_id + accessed_at on upload_sessions; migration 0097 omitted them.
-- Without these columns, INSERTs from Drizzle fail on existing databases.
ALTER TABLE "upload_sessions" ADD COLUMN IF NOT EXISTS "blob_id" text;
ALTER TABLE "upload_sessions"
ADD COLUMN IF NOT EXISTS "accessed_at" timestamp with time zone DEFAULT now() NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'upload_sessions_blob_id_space_blobs_id_fk'
  ) THEN
    ALTER TABLE "upload_sessions"
      ADD CONSTRAINT "upload_sessions_blob_id_space_blobs_id_fk"
      FOREIGN KEY ("blob_id") REFERENCES "public"."space_blobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "upload_sessions_blob_id_idx" ON "upload_sessions" USING btree ("blob_id");
