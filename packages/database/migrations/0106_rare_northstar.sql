ALTER TABLE "file_assets" ADD COLUMN IF NOT EXISTS "classification" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "file_assets_classification_idx" ON "file_assets" USING btree ("classification");
