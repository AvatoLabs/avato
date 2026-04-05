CREATE TABLE IF NOT EXISTS "file_assets" (
  "file_id" text PRIMARY KEY NOT NULL,
  "space_id" text NOT NULL,
  "created_by" text,
  "review_status" text DEFAULT 'draft' NOT NULL,
  "usage_policy" text DEFAULT 'internal' NOT NULL,
  "rights_owner" text,
  "reviewed_by" text,
  "reviewed_at" timestamp with time zone,
  "metadata" jsonb,
  "accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "file_assets" DROP CONSTRAINT IF EXISTS "file_assets_file_id_files_id_fk";
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_file_id_files_id_fk"
  FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "file_assets" DROP CONSTRAINT IF EXISTS "file_assets_space_id_spaces_id_fk";
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_space_id_spaces_id_fk"
  FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "file_assets" DROP CONSTRAINT IF EXISTS "file_assets_created_by_users_id_fk";
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "file_assets" DROP CONSTRAINT IF EXISTS "file_assets_reviewed_by_users_id_fk";
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "file_assets_space_id_idx" ON "file_assets" ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_assets_created_by_idx" ON "file_assets" ("created_by");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_assets_review_status_idx" ON "file_assets" ("review_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_assets_usage_policy_idx" ON "file_assets" ("usage_policy");
