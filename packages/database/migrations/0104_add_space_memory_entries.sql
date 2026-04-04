CREATE TABLE IF NOT EXISTS "space_memory_entries" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "space_id" text NOT NULL,
  "created_by" text NOT NULL,
  "updated_by" text,
  "reviewed_by" text,
  "status" varchar(32) DEFAULT 'candidate' NOT NULL,
  "category" varchar(32) DEFAULT 'general' NOT NULL,
  "title" varchar(255) NOT NULL,
  "summary" text,
  "content" text,
  "source_refs" jsonb,
  "metadata" jsonb,
  "published_at" timestamp with time zone,
  "accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "space_memory_entries" DROP CONSTRAINT IF EXISTS "space_memory_entries_space_id_spaces_id_fk";
ALTER TABLE "space_memory_entries" ADD CONSTRAINT "space_memory_entries_space_id_spaces_id_fk"
  FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "space_memory_entries" DROP CONSTRAINT IF EXISTS "space_memory_entries_created_by_users_id_fk";
ALTER TABLE "space_memory_entries" ADD CONSTRAINT "space_memory_entries_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "space_memory_entries" DROP CONSTRAINT IF EXISTS "space_memory_entries_updated_by_users_id_fk";
ALTER TABLE "space_memory_entries" ADD CONSTRAINT "space_memory_entries_updated_by_users_id_fk"
  FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

ALTER TABLE "space_memory_entries" DROP CONSTRAINT IF EXISTS "space_memory_entries_reviewed_by_users_id_fk";
ALTER TABLE "space_memory_entries" ADD CONSTRAINT "space_memory_entries_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "space_memory_entries_space_id_idx" ON "space_memory_entries" ("space_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_memory_entries_space_status_idx" ON "space_memory_entries" ("space_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_memory_entries_space_category_idx" ON "space_memory_entries" ("space_id","category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_memory_entries_reviewed_by_idx" ON "space_memory_entries" ("reviewed_by");
