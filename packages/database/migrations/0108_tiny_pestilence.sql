ALTER TABLE "space_memory_entries" ADD COLUMN IF NOT EXISTS "stale_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "space_memory_entries_stale_at_idx" ON "space_memory_entries" USING btree ("stale_at");
