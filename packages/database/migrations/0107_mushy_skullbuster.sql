ALTER TABLE "space_memory_entries" ADD COLUMN IF NOT EXISTS "recall_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "space_memory_entries" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "space_memory_entries" ADD COLUMN IF NOT EXISTS "last_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_memory_entries_space_recall_idx" ON "space_memory_entries" USING btree ("space_id","status","recall_enabled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_memory_entries_expires_at_idx" ON "space_memory_entries" USING btree ("expires_at");
