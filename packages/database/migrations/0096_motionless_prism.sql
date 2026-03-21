CREATE TABLE "resource_access_events" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text,
	"resource_uid" text,
	"share_link_id" text,
	"actor_id" text,
	"access_type" text NOT NULL,
	"source_ip" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text,
	"resource_uid" text,
	"actor_id" text,
	"action" text NOT NULL,
	"metadata" jsonb,
	"before" jsonb,
	"after" jsonb,
	"source_ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"resource_uid" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"role" text NOT NULL,
	"inherits_to_children" boolean DEFAULT true NOT NULL,
	"can_reshare" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_registry" (
	"resource_uid" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"local_id" text NOT NULL,
	"space_id" text NOT NULL,
	"authz_epoch" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" text,
	"metadata" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resource_share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"resource_uid" text NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"password_hash" text,
	"disabled_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_blobs" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"storage_key" text NOT NULL,
	"status" text NOT NULL,
	"size" integer NOT NULL,
	"file_type" varchar(255) NOT NULL,
	"etag" text,
	"verified_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"metadata" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_members" (
	"space_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "space_members_space_id_user_id_pk" PRIMARY KEY("space_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"personal_owner_id" text,
	"created_by" text NOT NULL,
	"authz_epoch" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp with time zone,
	"metadata" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "documents_client_id_user_id_unique";--> statement-breakpoint
DROP INDEX "documents_slug_user_id_unique";--> statement-breakpoint
DROP INDEX "files_client_id_user_id_unique";--> statement-breakpoint
DROP INDEX "knowledge_bases_client_id_user_id_unique";--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "space_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "resource_uid" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "inherit_mode" text DEFAULT 'inherit';--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "space_id" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "resource_uid" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "blob_id" text;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD COLUMN "space_id" text;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD COLUMN "resource_uid" text;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resource_access_events" ADD CONSTRAINT "resource_access_events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_access_events" ADD CONSTRAINT "resource_access_events_resource_uid_resource_registry_resource_uid_fk" FOREIGN KEY ("resource_uid") REFERENCES "public"."resource_registry"("resource_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_access_events" ADD CONSTRAINT "resource_access_events_share_link_id_resource_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."resource_share_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_access_events" ADD CONSTRAINT "resource_access_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_audit_logs" ADD CONSTRAINT "resource_audit_logs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_audit_logs" ADD CONSTRAINT "resource_audit_logs_resource_uid_resource_registry_resource_uid_fk" FOREIGN KEY ("resource_uid") REFERENCES "public"."resource_registry"("resource_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_audit_logs" ADD CONSTRAINT "resource_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_resource_uid_resource_registry_resource_uid_fk" FOREIGN KEY ("resource_uid") REFERENCES "public"."resource_registry"("resource_uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_permissions" ADD CONSTRAINT "resource_permissions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_registry" ADD CONSTRAINT "resource_registry_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_registry" ADD CONSTRAINT "resource_registry_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_share_links" ADD CONSTRAINT "resource_share_links_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_share_links" ADD CONSTRAINT "resource_share_links_resource_uid_resource_registry_resource_uid_fk" FOREIGN KEY ("resource_uid") REFERENCES "public"."resource_registry"("resource_uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_share_links" ADD CONSTRAINT "resource_share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_blobs" ADD CONSTRAINT "space_blobs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_blobs" ADD CONSTRAINT "space_blobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_personal_owner_id_users_id_fk" FOREIGN KEY ("personal_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resource_access_events_space_id_idx" ON "resource_access_events" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "resource_access_events_resource_uid_idx" ON "resource_access_events" USING btree ("resource_uid");--> statement-breakpoint
CREATE INDEX "resource_access_events_actor_id_idx" ON "resource_access_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "resource_access_events_share_link_id_idx" ON "resource_access_events" USING btree ("share_link_id");--> statement-breakpoint
CREATE INDEX "resource_audit_logs_space_id_idx" ON "resource_audit_logs" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "resource_audit_logs_resource_uid_idx" ON "resource_audit_logs" USING btree ("resource_uid");--> statement-breakpoint
CREATE INDEX "resource_audit_logs_actor_id_idx" ON "resource_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "resource_audit_logs_action_idx" ON "resource_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_permissions_subject_unique" ON "resource_permissions" USING btree ("resource_uid","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "resource_permissions_space_id_idx" ON "resource_permissions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "resource_permissions_subject_lookup_idx" ON "resource_permissions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_registry_kind_local_id_unique" ON "resource_registry" USING btree ("kind","local_id");--> statement-breakpoint
CREATE INDEX "resource_registry_space_id_idx" ON "resource_registry" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "resource_registry_created_by_idx" ON "resource_registry" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "resource_share_links_token_hash_unique" ON "resource_share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "resource_share_links_resource_uid_idx" ON "resource_share_links" USING btree ("resource_uid");--> statement-breakpoint
CREATE INDEX "resource_share_links_space_id_idx" ON "resource_share_links" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "space_blobs_space_sha_unique" ON "space_blobs" USING btree ("space_id","sha256");--> statement-breakpoint
CREATE INDEX "space_blobs_status_idx" ON "space_blobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "space_blobs_created_by_idx" ON "space_blobs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "space_members_user_id_idx" ON "space_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "space_members_role_idx" ON "space_members" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "space_members_owner_unique" ON "space_members" USING btree ("space_id") WHERE "space_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "spaces_created_by_idx" ON "spaces" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "spaces_kind_idx" ON "spaces" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "spaces_personal_owner_unique" ON "spaces" USING btree ("personal_owner_id") WHERE "spaces"."personal_owner_id" is not null;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_resource_uid_resource_registry_resource_uid_fk" FOREIGN KEY ("resource_uid") REFERENCES "public"."resource_registry"("resource_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_resource_uid_resource_registry_resource_uid_fk" FOREIGN KEY ("resource_uid") REFERENCES "public"."resource_registry"("resource_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_blob_id_space_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."space_blobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_resource_uid_resource_registry_resource_uid_fk" FOREIGN KEY ("resource_uid") REFERENCES "public"."resource_registry"("resource_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_space_id_idx" ON "documents" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "documents_resource_uid_idx" ON "documents" USING btree ("resource_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_client_id_space_id_unique" ON "documents" USING btree ("client_id","space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_slug_space_id_unique" ON "documents" USING btree ("slug","space_id") WHERE "documents"."slug" is not null;--> statement-breakpoint
CREATE INDEX "files_space_id_idx" ON "files" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "files_resource_uid_idx" ON "files" USING btree ("resource_uid");--> statement-breakpoint
CREATE INDEX "files_blob_id_idx" ON "files" USING btree ("blob_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_client_id_space_id_unique" ON "files" USING btree ("client_id","space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_bases_client_id_space_id_unique" ON "knowledge_bases" USING btree ("client_id","space_id");--> statement-breakpoint
CREATE INDEX "knowledge_bases_space_id_idx" ON "knowledge_bases" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "knowledge_bases_resource_uid_idx" ON "knowledge_bases" USING btree ("resource_uid");--> statement-breakpoint
INSERT INTO "spaces" ("id", "name", "kind", "personal_owner_id", "created_by", "authz_epoch", "created_at", "updated_at")
SELECT
  'spc_p_' || substr(md5(u.id), 1, 12),
  COALESCE(NULLIF(u.full_name, ''), NULLIF(u.username, ''), 'Personal Space'),
  'personal',
  u.id,
  u.id,
  1,
  now(),
  now()
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "spaces" s WHERE s.personal_owner_id = u.id
);
--> statement-breakpoint
INSERT INTO "space_members" ("space_id", "user_id", "role", "created_by", "created_at", "updated_at")
SELECT s.id, s.personal_owner_id, 'owner', s.personal_owner_id, now(), now()
FROM "spaces" s
WHERE s.kind = 'personal'
  AND s.personal_owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "space_members" sm WHERE sm.space_id = s.id AND sm.user_id = s.personal_owner_id
  );
--> statement-breakpoint
UPDATE "documents" d
SET "space_id" = s.id
FROM "spaces" s
WHERE d.user_id = s.personal_owner_id
  AND s.kind = 'personal'
  AND d.space_id IS NULL;
--> statement-breakpoint
UPDATE "files" f
SET "space_id" = s.id
FROM "spaces" s
WHERE f.user_id = s.personal_owner_id
  AND s.kind = 'personal'
  AND f.space_id IS NULL;
--> statement-breakpoint
UPDATE "knowledge_bases" kb
SET "space_id" = s.id
FROM "spaces" s
WHERE kb.user_id = s.personal_owner_id
  AND s.kind = 'personal'
  AND kb.space_id IS NULL;
--> statement-breakpoint
INSERT INTO "resource_registry" ("resource_uid", "kind", "local_id", "space_id", "created_by", "created_at", "updated_at")
SELECT
  'res_doc_' || substr(md5(d.id), 1, 12),
  'document',
  d.id,
  d.space_id,
  d.user_id,
  now(),
  now()
FROM "documents" d
WHERE d.space_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "resource_registry" r WHERE r.kind = 'document' AND r.local_id = d.id
  );
--> statement-breakpoint
INSERT INTO "resource_registry" ("resource_uid", "kind", "local_id", "space_id", "created_by", "created_at", "updated_at")
SELECT
  'res_file_' || substr(md5(f.id), 1, 12),
  'file',
  f.id,
  f.space_id,
  f.user_id,
  now(),
  now()
FROM "files" f
WHERE f.space_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "resource_registry" r WHERE r.kind = 'file' AND r.local_id = f.id
  );
--> statement-breakpoint
INSERT INTO "resource_registry" ("resource_uid", "kind", "local_id", "space_id", "created_by", "created_at", "updated_at")
SELECT
  'res_kb_' || substr(md5(kb.id), 1, 12),
  'knowledge_base',
  kb.id,
  kb.space_id,
  kb.user_id,
  now(),
  now()
FROM "knowledge_bases" kb
WHERE kb.space_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "resource_registry" r WHERE r.kind = 'knowledge_base' AND r.local_id = kb.id
  );
--> statement-breakpoint
UPDATE "documents" d
SET "resource_uid" = r.resource_uid
FROM "resource_registry" r
WHERE r.kind = 'document'
  AND r.local_id = d.id
  AND d.resource_uid IS NULL;
--> statement-breakpoint
UPDATE "files" f
SET "resource_uid" = r.resource_uid
FROM "resource_registry" r
WHERE r.kind = 'file'
  AND r.local_id = f.id
  AND f.resource_uid IS NULL;
--> statement-breakpoint
UPDATE "knowledge_bases" kb
SET "resource_uid" = r.resource_uid
FROM "resource_registry" r
WHERE r.kind = 'knowledge_base'
  AND r.local_id = kb.id
  AND kb.resource_uid IS NULL;
--> statement-breakpoint
INSERT INTO "resource_permissions" (
  "id",
  "space_id",
  "resource_uid",
  "subject_type",
  "subject_id",
  "role",
  "inherits_to_children",
  "can_reshare",
  "created_by",
  "created_at",
  "updated_at"
)
SELECT
  'rpm_' || substr(md5(r.resource_uid || ':' || s.personal_owner_id), 1, 12),
  r.space_id,
  r.resource_uid,
  'user',
  s.personal_owner_id,
  'owner',
  true,
  true,
  s.personal_owner_id,
  now(),
  now()
FROM "resource_registry" r
INNER JOIN "spaces" s ON s.id = r.space_id
WHERE s.personal_owner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "resource_permissions" rp
    WHERE rp.resource_uid = r.resource_uid
      AND rp.subject_type = 'user'
      AND rp.subject_id = s.personal_owner_id
  );
