-- Partial unique index: (slug, space_id) only for rows not in trash, so slug can be reused after soft delete.
DROP INDEX IF EXISTS "documents_slug_space_id_unique";
CREATE UNIQUE INDEX "documents_slug_space_id_unique" ON "documents" USING btree ("slug", "space_id") WHERE ("slug" IS NOT NULL AND "deleted_at" IS NULL);
