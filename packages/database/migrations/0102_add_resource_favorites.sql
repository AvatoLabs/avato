CREATE TABLE IF NOT EXISTS "resource_favorites" (
	"user_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"source_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_favorites_pkey" PRIMARY KEY ("user_id", "resource_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "resource_favorites" ADD CONSTRAINT "resource_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resource_favorites_user_id_idx" ON "resource_favorites" USING btree ("user_id");
