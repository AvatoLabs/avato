ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "tag_id" text;
--> statement-breakpoint
ALTER TABLE "topics" DROP CONSTRAINT IF EXISTS "topics_tag_id_session_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_tag_id_session_tags_id_fk"
  FOREIGN KEY ("tag_id") REFERENCES "public"."session_tags"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "topics_tag_id_idx" ON "topics" USING btree ("tag_id");
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'tag_id'
  ) THEN
    UPDATE "topics" t
    SET "tag_id" = s."tag_id"
    FROM "sessions" s
    WHERE t."session_id" = s."id"
      AND t."tag_id" IS NULL
      AND s."tag_id" IS NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_tag_id_session_tags_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_tag_id_idx";
--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "tag_id";
