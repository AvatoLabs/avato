-- Partial unique: (client_id, space_id) only for active rows so sync clients can reuse after soft delete.
DROP INDEX IF EXISTS "documents_client_id_space_id_unique";
CREATE UNIQUE INDEX "documents_client_id_space_id_unique" ON "documents" USING btree ("client_id", "space_id") WHERE ("client_id" IS NOT NULL AND "deleted_at" IS NULL);
