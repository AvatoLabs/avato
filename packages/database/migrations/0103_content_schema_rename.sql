DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agents_knowledge_bases')
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agents_source_sets') THEN
    ALTER TABLE "agents_knowledge_bases" RENAME TO "agents_source_sets";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'knowledge_base_files')
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'source_set_files') THEN
    ALTER TABLE "knowledge_base_files" RENAME TO "source_set_files";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'knowledge_bases')
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'source_sets') THEN
    ALTER TABLE "knowledge_bases" RENAME TO "source_sets";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_registry')
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_registry') THEN
    ALTER TABLE "resource_registry" RENAME TO "content_registry";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_permissions')
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_permissions') THEN
    ALTER TABLE "resource_permissions" RENAME TO "content_permissions";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_share_links')
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_share_links') THEN
    ALTER TABLE "resource_share_links" RENAME TO "content_share_links";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_audit_logs')
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_audit_logs') THEN
    ALTER TABLE "resource_audit_logs" RENAME TO "content_audit_logs";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'resource_access_events')
    AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'content_access_events') THEN
    ALTER TABLE "resource_access_events" RENAME TO "content_access_events";
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agents_source_sets' AND column_name = 'knowledge_base_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agents_source_sets' AND column_name = 'source_set_id'
  ) THEN
    ALTER TABLE "agents_source_sets" RENAME COLUMN "knowledge_base_id" TO "source_set_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'source_set_files' AND column_name = 'knowledge_base_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'source_set_files' AND column_name = 'source_set_id'
  ) THEN
    ALTER TABLE "source_set_files" RENAME COLUMN "knowledge_base_id" TO "source_set_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'knowledge_base_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'source_set_id'
  ) THEN
    ALTER TABLE "documents" RENAME COLUMN "knowledge_base_id" TO "source_set_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_eval_datasets' AND column_name = 'knowledge_base_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_eval_datasets' AND column_name = 'source_set_id'
  ) THEN
    ALTER TABLE "rag_eval_datasets" RENAME COLUMN "knowledge_base_id" TO "source_set_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_eval_evaluations' AND column_name = 'knowledge_base_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'rag_eval_evaluations' AND column_name = 'source_set_id'
  ) THEN
    ALTER TABLE "rag_eval_evaluations" RENAME COLUMN "knowledge_base_id" TO "source_set_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'resource_uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'content_uid'
  ) THEN
    ALTER TABLE "documents" RENAME COLUMN "resource_uid" TO "content_uid";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'files' AND column_name = 'resource_uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'files' AND column_name = 'content_uid'
  ) THEN
    ALTER TABLE "files" RENAME COLUMN "resource_uid" TO "content_uid";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'source_sets' AND column_name = 'resource_uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'source_sets' AND column_name = 'content_uid'
  ) THEN
    ALTER TABLE "source_sets" RENAME COLUMN "resource_uid" TO "content_uid";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_registry' AND column_name = 'resource_uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_registry' AND column_name = 'content_uid'
  ) THEN
    ALTER TABLE "content_registry" RENAME COLUMN "resource_uid" TO "content_uid";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_permissions' AND column_name = 'resource_uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_permissions' AND column_name = 'content_uid'
  ) THEN
    ALTER TABLE "content_permissions" RENAME COLUMN "resource_uid" TO "content_uid";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_share_links' AND column_name = 'resource_uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_share_links' AND column_name = 'content_uid'
  ) THEN
    ALTER TABLE "content_share_links" RENAME COLUMN "resource_uid" TO "content_uid";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_audit_logs' AND column_name = 'resource_uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_audit_logs' AND column_name = 'content_uid'
  ) THEN
    ALTER TABLE "content_audit_logs" RENAME COLUMN "resource_uid" TO "content_uid";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_access_events' AND column_name = 'resource_uid'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'content_access_events' AND column_name = 'content_uid'
  ) THEN
    ALTER TABLE "content_access_events" RENAME COLUMN "resource_uid" TO "content_uid";
  END IF;
END $$;--> statement-breakpoint

ALTER INDEX IF EXISTS "agents_knowledge_bases_agent_id_idx" RENAME TO "agents_source_sets_agent_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "agents_knowledge_bases_knowledge_base_id_idx" RENAME TO "agents_source_sets_source_set_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "agents_knowledge_bases_user_id_idx" RENAME TO "agents_source_sets_user_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "knowledge_base_files_kb_id_idx" RENAME TO "source_set_files_source_set_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "knowledge_base_files_user_id_idx" RENAME TO "source_set_files_user_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "knowledge_base_files_file_id_idx" RENAME TO "source_set_files_file_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "kbf_space_id_idx" RENAME TO "source_set_files_space_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "knowledge_bases_client_id_space_id_unique" RENAME TO "source_sets_client_id_space_id_unique";--> statement-breakpoint
ALTER INDEX IF EXISTS "knowledge_bases_user_id_idx" RENAME TO "source_sets_user_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "knowledge_bases_space_id_idx" RENAME TO "source_sets_space_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "knowledge_bases_resource_uid_idx" RENAME TO "source_sets_content_uid_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "documents_knowledge_base_id_idx" RENAME TO "documents_source_set_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "documents_resource_uid_idx" RENAME TO "documents_content_uid_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "files_resource_uid_idx" RENAME TO "files_content_uid_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_registry_kind_local_id_unique" RENAME TO "content_registry_kind_local_id_unique";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_registry_space_id_idx" RENAME TO "content_registry_space_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_registry_created_by_idx" RENAME TO "content_registry_created_by_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_permissions_subject_unique" RENAME TO "content_permissions_subject_unique";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_permissions_space_id_idx" RENAME TO "content_permissions_space_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_permissions_subject_lookup_idx" RENAME TO "content_permissions_subject_lookup_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_share_links_token_hash_unique" RENAME TO "content_share_links_token_hash_unique";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_share_links_resource_uid_idx" RENAME TO "content_share_links_content_uid_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_share_links_space_id_idx" RENAME TO "content_share_links_space_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_audit_logs_space_id_idx" RENAME TO "content_audit_logs_space_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_audit_logs_resource_uid_idx" RENAME TO "content_audit_logs_content_uid_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_audit_logs_actor_id_idx" RENAME TO "content_audit_logs_actor_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_audit_logs_action_idx" RENAME TO "content_audit_logs_action_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_access_events_space_id_idx" RENAME TO "content_access_events_space_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_access_events_resource_uid_idx" RENAME TO "content_access_events_content_uid_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_access_events_actor_id_idx" RENAME TO "content_access_events_actor_id_idx";--> statement-breakpoint
ALTER INDEX IF EXISTS "resource_access_events_share_link_id_idx" RENAME TO "content_access_events_share_link_id_idx";--> statement-breakpoint
