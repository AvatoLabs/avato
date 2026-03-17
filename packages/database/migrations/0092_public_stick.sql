CREATE TABLE IF NOT EXISTS "session_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"color" text,
	"name" text NOT NULL,
	"sort" integer,
	"user_id" text NOT NULL,
	"client_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "tag_id" text;--> statement-breakpoint
ALTER TABLE "session_tags" DROP CONSTRAINT IF EXISTS "session_tags_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "session_tags" ADD CONSTRAINT "session_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_tags_client_id_user_id_unique" ON "session_tags" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_tags_user_id_idx" ON "session_tags" USING btree ("user_id");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'session_groups'
      AND column_name = 'color'
  ) THEN
    INSERT INTO "session_tags" (
      "id",
      "color",
      "name",
      "sort",
      "user_id",
      "client_id",
      "accessed_at",
      "created_at",
      "updated_at"
    )
    SELECT
      sg."id",
      sg."color",
      sg."name",
      sg."sort",
      sg."user_id",
      sg."client_id",
      sg."accessed_at",
      sg."created_at",
      sg."updated_at"
    FROM "session_groups" sg
    WHERE sg."color" IS NOT NULL
    ON CONFLICT ("id") DO UPDATE SET
      "color" = EXCLUDED."color",
      "name" = EXCLUDED."name",
      "sort" = EXCLUDED."sort",
      "client_id" = EXCLUDED."client_id",
      "updated_at" = EXCLUDED."updated_at";

    UPDATE "sessions" s
    SET "tag_id" = s."group_id"
    WHERE s."tag_id" IS NULL
      AND s."group_id" IN (
        SELECT sg."id"
        FROM "session_groups" sg
        WHERE sg."color" IS NOT NULL
      );
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_tag_id_session_tags_id_fk";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tag_id_session_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."session_tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_tag_id_idx" ON "sessions" USING btree ("tag_id");
