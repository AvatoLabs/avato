CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(100),
	"title" varchar(255),
	"description" varchar(1000),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"editor_data" jsonb,
	"avatar" text,
	"background_color" text,
	"market_identifier" text,
	"plugins" jsonb,
	"client_id" text,
	"user_id" text NOT NULL,
	"agency_config" jsonb,
	"chat_config" jsonb,
	"few_shots" jsonb,
	"model" text,
	"params" jsonb DEFAULT '{}'::jsonb,
	"provider" text,
	"system_role" text,
	"tts" jsonb,
	"virtual" boolean DEFAULT false,
	"pinned" boolean,
	"opening_message" text,
	"opening_questions" text[] DEFAULT '{}',
	"session_group_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents_files" (
	"file_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"user_id" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_files_file_id_agent_id_user_id_pk" PRIMARY KEY("file_id","agent_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "agents_source_sets" (
	"agent_id" text NOT NULL,
	"source_set_id" text NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_source_sets_agent_id_source_set_id_pk" PRIMARY KEY("agent_id","source_set_id")
);
--> statement-breakpoint
CREATE TABLE "agent_bot_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"platform" varchar(50) NOT NULL,
	"application_id" varchar(255) NOT NULL,
	"credentials" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_cron_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"group_id" text,
	"user_id" text NOT NULL,
	"name" text,
	"description" text,
	"enabled" boolean DEFAULT true,
	"cron_pattern" text NOT NULL,
	"timezone" text DEFAULT 'UTC',
	"content" text NOT NULL,
	"edit_data" jsonb,
	"max_executions" integer,
	"remaining_executions" integer,
	"execution_conditions" jsonb,
	"last_executed_at" timestamp,
	"total_executions" integer DEFAULT 0,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_eval_benchmarks" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rubrics" jsonb NOT NULL,
	"reference_url" text,
	"metadata" jsonb,
	"user_id" text,
	"is_system" boolean DEFAULT true NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_eval_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"benchmark_id" text NOT NULL,
	"identifier" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"description" text,
	"eval_mode" text,
	"eval_config" jsonb,
	"metadata" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_eval_run_topics" (
	"user_id" text NOT NULL,
	"run_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"test_case_id" text NOT NULL,
	"status" text,
	"score" real,
	"passed" boolean,
	"eval_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_eval_run_topics_run_id_topic_id_pk" PRIMARY KEY("run_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "agent_eval_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"target_agent_id" text,
	"user_id" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'idle' NOT NULL,
	"config" jsonb,
	"metrics" jsonb,
	"started_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_eval_test_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dataset_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"eval_mode" text,
	"eval_config" jsonb,
	"metadata" jsonb,
	"sort_order" integer,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"identifier" text NOT NULL,
	"source" text NOT NULL,
	"manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content" text,
	"editor_data" jsonb,
	"resources" jsonb DEFAULT '{}'::jsonb,
	"zip_file_hash" varchar(64),
	"user_id" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" varchar(150) NOT NULL,
	"display_name" varchar(200),
	"description" text,
	"organization" varchar(100),
	"enabled" boolean,
	"provider_id" varchar(64) NOT NULL,
	"type" varchar(20) DEFAULT 'chat' NOT NULL,
	"sort" integer,
	"user_id" text NOT NULL,
	"pricing" jsonb,
	"parameters" jsonb DEFAULT '{}'::jsonb,
	"config" jsonb,
	"abilities" jsonb DEFAULT '{}'::jsonb,
	"context_window_tokens" integer,
	"source" varchar(20),
	"released_at" varchar(10),
	"settings" jsonb DEFAULT '{}'::jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_models_id_provider_id_user_id_pk" PRIMARY KEY("id","provider_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" varchar(64) NOT NULL,
	"name" text,
	"user_id" text NOT NULL,
	"sort" integer,
	"enabled" boolean,
	"fetch_on_client" boolean,
	"check_model" text,
	"logo" text,
	"description" text,
	"key_vaults" text,
	"source" varchar(20),
	"settings" jsonb,
	"config" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_providers_id_user_id_pk" PRIMARY KEY("id","user_id")
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(256) NOT NULL,
	"key" varchar(256) NOT NULL,
	"key_hash" varchar(128),
	"enabled" boolean DEFAULT true,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key"),
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "file_assets" (
	"file_id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"created_by" text,
	"classification" text DEFAULT 'general' NOT NULL,
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
CREATE TABLE "async_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text,
	"status" text,
	"error" jsonb,
	"inference_id" text,
	"user_id" text NOT NULL,
	"duration" integer,
	"parent_id" uuid,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"aaguid" text,
	"backedUp" boolean,
	"counter" integer,
	"createdAt" timestamp DEFAULT now(),
	"credentialID" text NOT NULL,
	"deviceType" text,
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"publicKey" text NOT NULL,
	"transports" text,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"impersonated_by" text,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"backup_codes" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"avatar" text,
	"background_color" text,
	"market_identifier" text,
	"content" text,
	"editor_data" jsonb,
	"config" jsonb,
	"client_id" text,
	"user_id" text NOT NULL,
	"group_id" text,
	"pinned" boolean DEFAULT false,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_groups_agents" (
	"chat_group_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT true,
	"order" integer DEFAULT 0,
	"role" text DEFAULT 'participant',
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_groups_agents_chat_group_id_agent_id_pk" PRIMARY KEY("chat_group_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "content_access_events" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text,
	"content_uid" text,
	"share_link_id" text,
	"actor_id" text,
	"access_type" text NOT NULL,
	"source_ip" text,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text,
	"content_uid" text,
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
CREATE TABLE "content_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"content_uid" text NOT NULL,
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
CREATE TABLE "content_registry" (
	"content_uid" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "content_share_links" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"content_uid" text NOT NULL,
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
CREATE TABLE "upload_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text,
	"blob_id" text,
	"storage_key" text NOT NULL,
	"expected_size" integer NOT NULL,
	"expected_sha256" varchar(64),
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"etag" text,
	"created_by" text,
	"metadata" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"content" text,
	"file_type" varchar(255) NOT NULL,
	"filename" text,
	"total_char_count" integer NOT NULL,
	"total_line_count" integer NOT NULL,
	"metadata" jsonb,
	"pages" jsonb,
	"source_type" text NOT NULL,
	"source" text NOT NULL,
	"file_id" text,
	"source_set_id" text,
	"space_id" text,
	"content_uid" text,
	"parent_id" varchar(255),
	"inherit_mode" text DEFAULT 'inherit',
	"deleted_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"client_id" text,
	"editor_data" jsonb,
	"slug" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_type" varchar(255) NOT NULL,
	"file_hash" varchar(64),
	"name" text NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"source" text,
	"space_id" text,
	"content_uid" text,
	"blob_id" text,
	"parent_id" varchar(255),
	"deleted_at" timestamp with time zone,
	"client_id" text,
	"metadata" jsonb,
	"chunk_task_id" uuid,
	"embedding_task_id" uuid,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "global_files" (
	"hash_id" varchar(64) PRIMARY KEY NOT NULL,
	"file_type" varchar(255) NOT NULL,
	"size" integer NOT NULL,
	"url" text NOT NULL,
	"metadata" jsonb,
	"creator" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_set_files" (
	"source_set_id" text NOT NULL,
	"file_id" text NOT NULL,
	"user_id" text NOT NULL,
	"space_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_set_files_source_set_id_file_id_pk" PRIMARY KEY("source_set_id","file_id")
);
--> statement-breakpoint
CREATE TABLE "source_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"avatar" text,
	"type" text,
	"space_id" text,
	"content_uid" text,
	"user_id" text NOT NULL,
	"client_id" text,
	"settings" jsonb,
	"deleted_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"generation_topic_id" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"width" integer,
	"height" integer,
	"ratio" varchar(64),
	"config" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"cover_url" text,
	"type" varchar(32) DEFAULT 'image' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"generation_batch_id" varchar(64) NOT NULL,
	"async_task_id" uuid,
	"file_id" text,
	"seed" integer,
	"asset" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_chunks" (
	"message_id" text,
	"chunk_id" uuid,
	"user_id" text NOT NULL,
	CONSTRAINT "message_chunks_chunk_id_message_id_pk" PRIMARY KEY("chunk_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "message_groups" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"topic_id" text,
	"user_id" text NOT NULL,
	"parent_group_id" varchar(255),
	"parent_message_id" text,
	"title" varchar(255),
	"description" text,
	"type" text,
	"content" text,
	"editor_data" jsonb,
	"metadata" jsonb,
	"client_id" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_plugins" (
	"id" text PRIMARY KEY NOT NULL,
	"tool_call_id" text,
	"type" text DEFAULT 'default',
	"intervention" jsonb,
	"api_name" text,
	"arguments" text,
	"identifier" text,
	"state" jsonb,
	"error" jsonb,
	"client_id" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"rewrite_query" text,
	"user_query" text,
	"client_id" text,
	"user_id" text NOT NULL,
	"embeddings_id" uuid
);
--> statement-breakpoint
CREATE TABLE "message_query_chunks" (
	"id" text,
	"query_id" uuid,
	"chunk_id" uuid,
	"similarity" numeric(6, 5),
	"user_id" text NOT NULL,
	CONSTRAINT "message_query_chunks_chunk_id_id_query_id_pk" PRIMARY KEY("chunk_id","id","query_id")
);
--> statement-breakpoint
CREATE TABLE "message_tts" (
	"id" text PRIMARY KEY NOT NULL,
	"content_md5" text,
	"file_id" text,
	"voice" text,
	"client_id" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_translates" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text,
	"from" text,
	"to" text,
	"client_id" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"role" varchar(255) NOT NULL,
	"content" text,
	"editor_data" jsonb,
	"summary" text,
	"reasoning" jsonb,
	"search" jsonb,
	"metadata" jsonb,
	"model" text,
	"provider" text,
	"favorite" boolean DEFAULT false,
	"error" jsonb,
	"tools" jsonb,
	"trace_id" text,
	"observation_id" text,
	"client_id" text,
	"user_id" text NOT NULL,
	"session_id" text,
	"topic_id" text,
	"thread_id" text,
	"parent_id" text,
	"quota_id" text,
	"agent_id" text,
	"group_id" text,
	"target_id" text,
	"message_group_id" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages_files" (
	"file_id" text NOT NULL,
	"message_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "messages_files_file_id_message_id_pk" PRIMARY KEY("file_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "nextauth_accounts" (
	"access_token" text,
	"expires_at" integer,
	"id_token" text,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"scope" text,
	"session_state" text,
	"token_type" text,
	"type" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "nextauth_accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "nextauth_authenticators" (
	"counter" integer NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialID" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"transports" text,
	"user_id" text NOT NULL,
	CONSTRAINT "nextauth_authenticators_user_id_credentialID_pk" PRIMARY KEY("user_id","credentialID"),
	CONSTRAINT "nextauth_authenticators_credentialID_unique" UNIQUE("credentialID")
);
--> statement-breakpoint
CREATE TABLE "nextauth_sessions" (
	"expires" timestamp NOT NULL,
	"sessionToken" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextauth_verificationtokens" (
	"expires" timestamp NOT NULL,
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	CONSTRAINT "nextauth_verificationtokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "oauth_handoffs" (
	"id" text PRIMARY KEY NOT NULL,
	"client" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_access_tokens" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"grant_id" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_authorization_codes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"grant_id" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_clients" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"client_secret" varchar(255),
	"redirect_uris" text[] NOT NULL,
	"grants" text[] NOT NULL,
	"response_types" text[] NOT NULL,
	"scopes" text[] NOT NULL,
	"token_endpoint_auth_method" varchar(20),
	"application_type" varchar(20),
	"client_uri" text,
	"logo_uri" text,
	"policy_uri" text,
	"tos_uri" text,
	"is_first_party" boolean DEFAULT false,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_consents" (
	"user_id" text NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_consents_user_id_client_id_pk" PRIMARY KEY("user_id","client_id")
);
--> statement-breakpoint
CREATE TABLE "oidc_device_codes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"user_id" text,
	"client_id" varchar(255) NOT NULL,
	"grant_id" varchar(255),
	"user_code" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_grants" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_interactions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_refresh_tokens" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"user_id" text NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"grant_id" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oidc_sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_id" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text,
	"abstract" text,
	"metadata" jsonb,
	"index" integer,
	"type" varchar,
	"client_id" text,
	"user_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"document_id" varchar(30) NOT NULL,
	"chunk_id" uuid NOT NULL,
	"page_index" integer,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_chunks_document_id_chunk_id_pk" PRIMARY KEY("document_id","chunk_id")
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" uuid,
	"embeddings" vector(1024),
	"model" text,
	"client_id" text,
	"user_id" text,
	CONSTRAINT "embeddings_chunk_id_unique" UNIQUE("chunk_id")
);
--> statement-breakpoint
CREATE TABLE "unstructured_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text,
	"metadata" jsonb,
	"index" integer,
	"type" varchar,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parent_id" varchar,
	"composite_id" uuid,
	"client_id" text,
	"user_id" text,
	"file_id" varchar
);
--> statement-breakpoint
CREATE TABLE "rag_eval_dataset_records" (
	"id" text PRIMARY KEY NOT NULL,
	"dataset_id" text NOT NULL,
	"ideal" text,
	"question" text,
	"reference_files" text[],
	"metadata" jsonb,
	"user_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_eval_datasets" (
	"id" text PRIMARY KEY NOT NULL,
	"description" text,
	"name" text NOT NULL,
	"source_set_id" text,
	"user_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_eval_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"eval_records_url" text,
	"status" text,
	"error" jsonb,
	"dataset_id" text NOT NULL,
	"source_set_id" text,
	"language_model" text,
	"embedding_model" text,
	"user_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_eval_evaluation_records" (
	"id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"answer" text,
	"context" text[],
	"ideal" text,
	"status" text,
	"error" jsonb,
	"language_model" text,
	"embedding_model" text,
	"question_embedding_id" uuid,
	"duration" integer,
	"dataset_record_id" text NOT NULL,
	"evaluation_id" text NOT NULL,
	"user_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "rbac_role_permissions" (
	"role_id" text NOT NULL,
	"permission_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "rbac_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rbac_roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rbac_user_roles" (
	"user_id" text NOT NULL,
	"role_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "rbac_user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "agents_to_sessions" (
	"agent_id" text NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "agents_to_sessions_agent_id_session_id_pk" PRIMARY KEY("agent_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "file_chunks" (
	"file_id" varchar,
	"chunk_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "file_chunks_file_id_chunk_id_pk" PRIMARY KEY("file_id","chunk_id")
);
--> statement-breakpoint
CREATE TABLE "files_to_sessions" (
	"file_id" text NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "files_to_sessions_file_id_session_id_pk" PRIMARY KEY("file_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "session_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort" integer,
	"user_id" text NOT NULL,
	"client_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(100) NOT NULL,
	"title" text,
	"description" text,
	"avatar" text,
	"background_color" text,
	"type" text DEFAULT 'agent',
	"user_id" text NOT NULL,
	"group_id" text,
	"client_id" text,
	"pinned" boolean DEFAULT false,
	"config" jsonb,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_memory_entries" (
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
	"recall_enabled" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"stale_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"color" text,
	"name" text NOT NULL,
	"sort" integer,
	"user_id" text NOT NULL,
	"client_id" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"content" text,
	"editor_data" jsonb,
	"type" text NOT NULL,
	"status" text,
	"topic_id" text NOT NULL,
	"source_message_id" text,
	"parent_thread_id" text,
	"client_id" text,
	"agent_id" text,
	"group_id" text,
	"metadata" jsonb,
	"user_id" text NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now(),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_documents" (
	"document_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_documents_document_id_topic_id_pk" PRIMARY KEY("document_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "topic_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"user_id" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"page_view_count" integer DEFAULT 0 NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"favorite" boolean DEFAULT false,
	"session_id" text,
	"tag_id" text,
	"content" text,
	"editor_data" jsonb,
	"agent_id" text,
	"group_id" text,
	"space_id" text,
	"user_id" text NOT NULL,
	"client_id" text,
	"history_summary" text,
	"metadata" jsonb,
	"trigger" text,
	"mode" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_installed_plugins" (
	"user_id" text NOT NULL,
	"identifier" text NOT NULL,
	"type" text NOT NULL,
	"manifest" jsonb,
	"settings" jsonb,
	"custom_params" jsonb,
	"source" varchar(255),
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_installed_plugins_user_id_identifier_pk" PRIMARY KEY("user_id","identifier")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"tts" jsonb,
	"hotkey" jsonb,
	"key_vaults" text,
	"general" jsonb,
	"language_model" jsonb,
	"system_agent" jsonb,
	"default_agent" jsonb,
	"market" jsonb,
	"memory" jsonb,
	"tool" jsonb,
	"image" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text,
	"email" text,
	"normalized_email" text,
	"avatar" text,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"interests" varchar(64)[],
	"is_onboarded" boolean DEFAULT false,
	"onboarding" jsonb,
	"clerk_created_at" timestamp with time zone,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"preference" jsonb,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false,
	"phone_number_verified" boolean,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_normalized_email_unique" UNIQUE("normalized_email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "user_memories" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"memory_category" varchar(255),
	"memory_layer" varchar(255),
	"memory_type" varchar(255),
	"metadata" jsonb,
	"tags" text[],
	"title" varchar(255),
	"summary" text,
	"summary_vector_1024" vector(1024),
	"details" text,
	"details_vector_1024" vector(1024),
	"status" varchar(255),
	"accessed_count" bigint DEFAULT 0,
	"last_accessed_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories_activities" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_memory_id" varchar(255),
	"metadata" jsonb,
	"tags" text[],
	"type" varchar(255) NOT NULL,
	"status" varchar(255) DEFAULT 'pending' NOT NULL,
	"timezone" varchar(255),
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"associated_objects" jsonb,
	"associated_subjects" jsonb,
	"associated_locations" jsonb,
	"notes" text,
	"narrative" text,
	"narrative_vector" vector(1024),
	"feedback" text,
	"feedback_vector" vector(1024),
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories_contexts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_memory_ids" jsonb,
	"metadata" jsonb,
	"tags" text[],
	"associated_objects" jsonb,
	"associated_subjects" jsonb,
	"title" text,
	"description" text,
	"description_vector" vector(1024),
	"type" varchar(255),
	"current_status" text,
	"score_impact" numeric DEFAULT 0,
	"score_urgency" numeric DEFAULT 0,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories_experiences" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_memory_id" varchar(255),
	"metadata" jsonb,
	"tags" text[],
	"type" varchar(255),
	"situation" text,
	"situation_vector" vector(1024),
	"reasoning" text,
	"possible_outcome" text,
	"action" text,
	"action_vector" vector(1024),
	"key_learning" text,
	"key_learning_vector" vector(1024),
	"score_confidence" real DEFAULT 0,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories_identities" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_memory_id" varchar(255),
	"metadata" jsonb,
	"tags" text[],
	"type" varchar(255),
	"description" text,
	"description_vector" vector(1024),
	"episodic_date" timestamp with time zone,
	"relationship" varchar(255),
	"role" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memories_preferences" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_memory_id" varchar(255),
	"metadata" jsonb,
	"tags" text[],
	"conclusion_directives" text,
	"conclusion_directives_vector" vector(1024),
	"type" varchar(255),
	"suggestions" text,
	"score_priority" numeric DEFAULT 0,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memory_persona_document_histories" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"persona_id" varchar(255),
	"profile" varchar(255) DEFAULT 'default' NOT NULL,
	"snapshot_persona" text,
	"snapshot_tagline" text,
	"reasoning" text,
	"diff_persona" text,
	"diff_tagline" text,
	"snapshot" text,
	"summary" text,
	"edited_by" varchar(255) DEFAULT 'agent',
	"memory_ids" jsonb,
	"source_ids" jsonb,
	"metadata" jsonb,
	"previous_version" integer,
	"next_version" integer,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_memory_persona_documents" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" text,
	"profile" varchar(255) DEFAULT 'default' NOT NULL,
	"tagline" text,
	"persona" text,
	"memory_ids" jsonb,
	"source_ids" jsonb,
	"metadata" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_session_group_id_session_groups_id_fk" FOREIGN KEY ("session_group_id") REFERENCES "public"."session_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_files" ADD CONSTRAINT "agents_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_files" ADD CONSTRAINT "agents_files_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_files" ADD CONSTRAINT "agents_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_source_sets" ADD CONSTRAINT "agents_source_sets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_source_sets" ADD CONSTRAINT "agents_source_sets_source_set_id_source_sets_id_fk" FOREIGN KEY ("source_set_id") REFERENCES "public"."source_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_source_sets" ADD CONSTRAINT "agents_source_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_bot_providers" ADD CONSTRAINT "agent_bot_providers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_bot_providers" ADD CONSTRAINT "agent_bot_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_cron_jobs" ADD CONSTRAINT "agent_cron_jobs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_cron_jobs" ADD CONSTRAINT "agent_cron_jobs_group_id_chat_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_cron_jobs" ADD CONSTRAINT "agent_cron_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_benchmarks" ADD CONSTRAINT "agent_eval_benchmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_datasets" ADD CONSTRAINT "agent_eval_datasets_benchmark_id_agent_eval_benchmarks_id_fk" FOREIGN KEY ("benchmark_id") REFERENCES "public"."agent_eval_benchmarks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_datasets" ADD CONSTRAINT "agent_eval_datasets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_run_topics" ADD CONSTRAINT "agent_eval_run_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_run_topics" ADD CONSTRAINT "agent_eval_run_topics_run_id_agent_eval_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_eval_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_run_topics" ADD CONSTRAINT "agent_eval_run_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_run_topics" ADD CONSTRAINT "agent_eval_run_topics_test_case_id_agent_eval_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."agent_eval_test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_runs" ADD CONSTRAINT "agent_eval_runs_dataset_id_agent_eval_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."agent_eval_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_runs" ADD CONSTRAINT "agent_eval_runs_target_agent_id_agents_id_fk" FOREIGN KEY ("target_agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_runs" ADD CONSTRAINT "agent_eval_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_test_cases" ADD CONSTRAINT "agent_eval_test_cases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_test_cases" ADD CONSTRAINT "agent_eval_test_cases_dataset_id_agent_eval_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."agent_eval_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_zip_file_hash_global_files_hash_id_fk" FOREIGN KEY ("zip_file_hash") REFERENCES "public"."global_files"("hash_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_providers" ADD CONSTRAINT "ai_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "async_tasks" ADD CONSTRAINT "async_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groups" ADD CONSTRAINT "chat_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groups" ADD CONSTRAINT "chat_groups_group_id_session_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."session_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groups_agents" ADD CONSTRAINT "chat_groups_agents_chat_group_id_chat_groups_id_fk" FOREIGN KEY ("chat_group_id") REFERENCES "public"."chat_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groups_agents" ADD CONSTRAINT "chat_groups_agents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_groups_agents" ADD CONSTRAINT "chat_groups_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_access_events" ADD CONSTRAINT "content_access_events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_access_events" ADD CONSTRAINT "content_access_events_content_uid_content_registry_content_uid_fk" FOREIGN KEY ("content_uid") REFERENCES "public"."content_registry"("content_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_access_events" ADD CONSTRAINT "content_access_events_share_link_id_content_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."content_share_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_access_events" ADD CONSTRAINT "content_access_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_audit_logs" ADD CONSTRAINT "content_audit_logs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_audit_logs" ADD CONSTRAINT "content_audit_logs_content_uid_content_registry_content_uid_fk" FOREIGN KEY ("content_uid") REFERENCES "public"."content_registry"("content_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_audit_logs" ADD CONSTRAINT "content_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_permissions" ADD CONSTRAINT "content_permissions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_permissions" ADD CONSTRAINT "content_permissions_content_uid_content_registry_content_uid_fk" FOREIGN KEY ("content_uid") REFERENCES "public"."content_registry"("content_uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_permissions" ADD CONSTRAINT "content_permissions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_registry" ADD CONSTRAINT "content_registry_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_registry" ADD CONSTRAINT "content_registry_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_share_links" ADD CONSTRAINT "content_share_links_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_share_links" ADD CONSTRAINT "content_share_links_content_uid_content_registry_content_uid_fk" FOREIGN KEY ("content_uid") REFERENCES "public"."content_registry"("content_uid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_share_links" ADD CONSTRAINT "content_share_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_blobs" ADD CONSTRAINT "space_blobs_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_blobs" ADD CONSTRAINT "space_blobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_members" ADD CONSTRAINT "space_members_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_personal_owner_id_users_id_fk" FOREIGN KEY ("personal_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_blob_id_space_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."space_blobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_set_id_source_sets_id_fk" FOREIGN KEY ("source_set_id") REFERENCES "public"."source_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_content_uid_content_registry_content_uid_fk" FOREIGN KEY ("content_uid") REFERENCES "public"."content_registry"("content_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_file_hash_global_files_hash_id_fk" FOREIGN KEY ("file_hash") REFERENCES "public"."global_files"("hash_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_content_uid_content_registry_content_uid_fk" FOREIGN KEY ("content_uid") REFERENCES "public"."content_registry"("content_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_blob_id_space_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."space_blobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_chunk_task_id_async_tasks_id_fk" FOREIGN KEY ("chunk_task_id") REFERENCES "public"."async_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_embedding_task_id_async_tasks_id_fk" FOREIGN KEY ("embedding_task_id") REFERENCES "public"."async_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_files" ADD CONSTRAINT "global_files_creator_users_id_fk" FOREIGN KEY ("creator") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_set_files" ADD CONSTRAINT "source_set_files_source_set_id_source_sets_id_fk" FOREIGN KEY ("source_set_id") REFERENCES "public"."source_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_set_files" ADD CONSTRAINT "source_set_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_set_files" ADD CONSTRAINT "source_set_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_set_files" ADD CONSTRAINT "source_set_files_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_sets" ADD CONSTRAINT "source_sets_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_sets" ADD CONSTRAINT "source_sets_content_uid_content_registry_content_uid_fk" FOREIGN KEY ("content_uid") REFERENCES "public"."content_registry"("content_uid") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_sets" ADD CONSTRAINT "source_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_batches" ADD CONSTRAINT "generation_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_batches" ADD CONSTRAINT "generation_batches_generation_topic_id_generation_topics_id_fk" FOREIGN KEY ("generation_topic_id") REFERENCES "public"."generation_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_topics" ADD CONSTRAINT "generation_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_generation_batch_id_generation_batches_id_fk" FOREIGN KEY ("generation_batch_id") REFERENCES "public"."generation_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_async_task_id_async_tasks_id_fk" FOREIGN KEY ("async_task_id") REFERENCES "public"."async_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_chunks" ADD CONSTRAINT "message_chunks_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_chunks" ADD CONSTRAINT "message_chunks_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_chunks" ADD CONSTRAINT "message_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_groups" ADD CONSTRAINT "message_groups_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_groups" ADD CONSTRAINT "message_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_groups" ADD CONSTRAINT "message_groups_parent_group_id_message_groups_id_fk" FOREIGN KEY ("parent_group_id") REFERENCES "public"."message_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_groups" ADD CONSTRAINT "message_groups_parent_message_id_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_plugins" ADD CONSTRAINT "message_plugins_id_messages_id_fk" FOREIGN KEY ("id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_plugins" ADD CONSTRAINT "message_plugins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_queries" ADD CONSTRAINT "message_queries_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_queries" ADD CONSTRAINT "message_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_queries" ADD CONSTRAINT "message_queries_embeddings_id_embeddings_id_fk" FOREIGN KEY ("embeddings_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_query_chunks" ADD CONSTRAINT "message_query_chunks_id_messages_id_fk" FOREIGN KEY ("id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_query_chunks" ADD CONSTRAINT "message_query_chunks_query_id_message_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."message_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_query_chunks" ADD CONSTRAINT "message_query_chunks_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_query_chunks" ADD CONSTRAINT "message_query_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tts" ADD CONSTRAINT "message_tts_id_messages_id_fk" FOREIGN KEY ("id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tts" ADD CONSTRAINT "message_tts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_tts" ADD CONSTRAINT "message_tts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_translates" ADD CONSTRAINT "message_translates_id_messages_id_fk" FOREIGN KEY ("id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_translates" ADD CONSTRAINT "message_translates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_id_messages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_quota_id_messages_id_fk" FOREIGN KEY ("quota_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_group_id_chat_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_message_group_id_message_groups_id_fk" FOREIGN KEY ("message_group_id") REFERENCES "public"."message_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages_files" ADD CONSTRAINT "messages_files_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages_files" ADD CONSTRAINT "messages_files_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages_files" ADD CONSTRAINT "messages_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextauth_accounts" ADD CONSTRAINT "nextauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextauth_authenticators" ADD CONSTRAINT "nextauth_authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextauth_sessions" ADD CONSTRAINT "nextauth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_access_tokens" ADD CONSTRAINT "oidc_access_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_authorization_codes" ADD CONSTRAINT "oidc_authorization_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_consents" ADD CONSTRAINT "oidc_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_consents" ADD CONSTRAINT "oidc_consents_client_id_oidc_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oidc_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_device_codes" ADD CONSTRAINT "oidc_device_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_grants" ADD CONSTRAINT "oidc_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_refresh_tokens" ADD CONSTRAINT "oidc_refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oidc_sessions" ADD CONSTRAINT "oidc_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unstructured_chunks" ADD CONSTRAINT "unstructured_chunks_composite_id_chunks_id_fk" FOREIGN KEY ("composite_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unstructured_chunks" ADD CONSTRAINT "unstructured_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unstructured_chunks" ADD CONSTRAINT "unstructured_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_dataset_records" ADD CONSTRAINT "rag_eval_dataset_records_dataset_id_rag_eval_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."rag_eval_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_dataset_records" ADD CONSTRAINT "rag_eval_dataset_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_datasets" ADD CONSTRAINT "rag_eval_datasets_source_set_id_source_sets_id_fk" FOREIGN KEY ("source_set_id") REFERENCES "public"."source_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_datasets" ADD CONSTRAINT "rag_eval_datasets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_evaluations" ADD CONSTRAINT "rag_eval_evaluations_dataset_id_rag_eval_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."rag_eval_datasets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_evaluations" ADD CONSTRAINT "rag_eval_evaluations_source_set_id_source_sets_id_fk" FOREIGN KEY ("source_set_id") REFERENCES "public"."source_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_evaluations" ADD CONSTRAINT "rag_eval_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_evaluation_records" ADD CONSTRAINT "rag_eval_evaluation_records_question_embedding_id_embeddings_id_fk" FOREIGN KEY ("question_embedding_id") REFERENCES "public"."embeddings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_evaluation_records" ADD CONSTRAINT "rag_eval_evaluation_records_dataset_record_id_rag_eval_dataset_records_id_fk" FOREIGN KEY ("dataset_record_id") REFERENCES "public"."rag_eval_dataset_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_evaluation_records" ADD CONSTRAINT "rag_eval_evaluation_records_evaluation_id_rag_eval_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."rag_eval_evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_eval_evaluation_records" ADD CONSTRAINT "rag_eval_evaluation_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permissions" ADD CONSTRAINT "rbac_role_permissions_role_id_rbac_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permissions" ADD CONSTRAINT "rbac_role_permissions_permission_id_rbac_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."rbac_permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "rbac_user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_user_roles" ADD CONSTRAINT "rbac_user_roles_role_id_rbac_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_to_sessions" ADD CONSTRAINT "agents_to_sessions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_to_sessions" ADD CONSTRAINT "agents_to_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents_to_sessions" ADD CONSTRAINT "agents_to_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_chunk_id_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files_to_sessions" ADD CONSTRAINT "files_to_sessions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files_to_sessions" ADD CONSTRAINT "files_to_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files_to_sessions" ADD CONSTRAINT "files_to_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_groups" ADD CONSTRAINT "session_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_group_id_session_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."session_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_memory_entries" ADD CONSTRAINT "space_memory_entries_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_memory_entries" ADD CONSTRAINT "space_memory_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_memory_entries" ADD CONSTRAINT "space_memory_entries_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_memory_entries" ADD CONSTRAINT "space_memory_entries_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_parent_thread_id_threads_id_fk" FOREIGN KEY ("parent_thread_id") REFERENCES "public"."threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_group_id_chat_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_documents" ADD CONSTRAINT "topic_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_documents" ADD CONSTRAINT "topic_documents_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_documents" ADD CONSTRAINT "topic_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_shares" ADD CONSTRAINT "topic_shares_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_shares" ADD CONSTRAINT "topic_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_group_id_chat_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_installed_plugins" ADD CONSTRAINT "user_installed_plugins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories" ADD CONSTRAINT "user_memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_activities" ADD CONSTRAINT "user_memories_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_activities" ADD CONSTRAINT "user_memories_activities_user_memory_id_user_memories_id_fk" FOREIGN KEY ("user_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_contexts" ADD CONSTRAINT "user_memories_contexts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_experiences" ADD CONSTRAINT "user_memories_experiences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_experiences" ADD CONSTRAINT "user_memories_experiences_user_memory_id_user_memories_id_fk" FOREIGN KEY ("user_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_identities" ADD CONSTRAINT "user_memories_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_identities" ADD CONSTRAINT "user_memories_identities_user_memory_id_user_memories_id_fk" FOREIGN KEY ("user_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD CONSTRAINT "user_memories_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memories_preferences" ADD CONSTRAINT "user_memories_preferences_user_memory_id_user_memories_id_fk" FOREIGN KEY ("user_memory_id") REFERENCES "public"."user_memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memory_persona_document_histories" ADD CONSTRAINT "user_memory_persona_document_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memory_persona_document_histories" ADD CONSTRAINT "user_memory_persona_document_histories_persona_id_user_memory_persona_documents_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."user_memory_persona_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memory_persona_documents" ADD CONSTRAINT "user_memory_persona_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_id_user_id_unique" ON "agents" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_slug_user_id_unique" ON "agents" USING btree ("slug","user_id");--> statement-breakpoint
CREATE INDEX "agents_user_id_idx" ON "agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agents_title_idx" ON "agents" USING btree ("title");--> statement-breakpoint
CREATE INDEX "agents_description_idx" ON "agents" USING btree ("description");--> statement-breakpoint
CREATE INDEX "agents_session_group_id_idx" ON "agents" USING btree ("session_group_id");--> statement-breakpoint
CREATE INDEX "agents_files_agent_id_idx" ON "agents_files" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agents_files_file_id_idx" ON "agents_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "agents_files_user_id_idx" ON "agents_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agents_source_sets_agent_id_idx" ON "agents_source_sets" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agents_source_sets_source_set_id_idx" ON "agents_source_sets" USING btree ("source_set_id");--> statement-breakpoint
CREATE INDEX "agents_source_sets_user_id_idx" ON "agents_source_sets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_bot_providers_platform_app_id_unique" ON "agent_bot_providers" USING btree ("platform","application_id");--> statement-breakpoint
CREATE INDEX "agent_bot_providers_platform_idx" ON "agent_bot_providers" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "agent_bot_providers_agent_id_idx" ON "agent_bot_providers" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_bot_providers_user_id_idx" ON "agent_bot_providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_cron_jobs_agent_id_idx" ON "agent_cron_jobs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_cron_jobs_group_id_idx" ON "agent_cron_jobs" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "agent_cron_jobs_user_id_idx" ON "agent_cron_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_cron_jobs_enabled_idx" ON "agent_cron_jobs" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "agent_cron_jobs_remaining_executions_idx" ON "agent_cron_jobs" USING btree ("remaining_executions");--> statement-breakpoint
CREATE INDEX "agent_cron_jobs_last_executed_at_idx" ON "agent_cron_jobs" USING btree ("last_executed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_eval_benchmarks_identifier_user_id_unique" ON "agent_eval_benchmarks" USING btree ("identifier","user_id");--> statement-breakpoint
CREATE INDEX "agent_eval_benchmarks_is_system_idx" ON "agent_eval_benchmarks" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "agent_eval_benchmarks_user_id_idx" ON "agent_eval_benchmarks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_eval_datasets_identifier_user_id_unique" ON "agent_eval_datasets" USING btree ("identifier","user_id");--> statement-breakpoint
CREATE INDEX "agent_eval_datasets_benchmark_id_idx" ON "agent_eval_datasets" USING btree ("benchmark_id");--> statement-breakpoint
CREATE INDEX "agent_eval_datasets_user_id_idx" ON "agent_eval_datasets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_eval_run_topics_user_id_idx" ON "agent_eval_run_topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_eval_run_topics_run_id_idx" ON "agent_eval_run_topics" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "agent_eval_run_topics_test_case_id_idx" ON "agent_eval_run_topics" USING btree ("test_case_id");--> statement-breakpoint
CREATE INDEX "agent_eval_runs_dataset_id_idx" ON "agent_eval_runs" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "agent_eval_runs_user_id_idx" ON "agent_eval_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_eval_runs_status_idx" ON "agent_eval_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_eval_runs_target_agent_id_idx" ON "agent_eval_runs" USING btree ("target_agent_id");--> statement-breakpoint
CREATE INDEX "agent_eval_test_cases_user_id_idx" ON "agent_eval_test_cases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_eval_test_cases_dataset_id_idx" ON "agent_eval_test_cases" USING btree ("dataset_id");--> statement-breakpoint
CREATE INDEX "agent_eval_test_cases_sort_order_idx" ON "agent_eval_test_cases" USING btree ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_skills_user_name_idx" ON "agent_skills" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "agent_skills_identifier_idx" ON "agent_skills" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "agent_skills_user_id_idx" ON "agent_skills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_skills_source_idx" ON "agent_skills" USING btree ("source");--> statement-breakpoint
CREATE INDEX "agent_skills_zip_hash_idx" ON "agent_skills" USING btree ("zip_file_hash");--> statement-breakpoint
CREATE INDEX "ai_models_user_id_idx" ON "ai_models" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_providers_user_id_idx" ON "ai_providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "file_assets_space_id_idx" ON "file_assets" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "file_assets_created_by_idx" ON "file_assets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "file_assets_classification_idx" ON "file_assets" USING btree ("classification");--> statement-breakpoint
CREATE INDEX "file_assets_review_status_idx" ON "file_assets" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX "file_assets_usage_policy_idx" ON "file_assets" USING btree ("usage_policy");--> statement-breakpoint
CREATE INDEX "async_tasks_user_id_idx" ON "async_tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "async_tasks_parent_id_idx" ON "async_tasks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "async_tasks_type_status_idx" ON "async_tasks" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "async_tasks_inference_id_idx" ON "async_tasks" USING btree ("inference_id");--> statement-breakpoint
CREATE INDEX "async_tasks_metadata_idx" ON "async_tasks" USING gin ("metadata");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credential_id_unique" ON "passkey" USING btree ("credentialID");--> statement-breakpoint
CREATE INDEX "passkey_user_id_idx" ON "passkey" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "auth_session_userId_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "two_factor_user_id_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_groups_client_id_user_id_unique" ON "chat_groups" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "chat_groups_user_id_idx" ON "chat_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_groups_group_id_idx" ON "chat_groups" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "chat_groups_agents_user_id_idx" ON "chat_groups_agents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "content_access_events_space_id_idx" ON "content_access_events" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "content_access_events_content_uid_idx" ON "content_access_events" USING btree ("content_uid");--> statement-breakpoint
CREATE INDEX "content_access_events_actor_id_idx" ON "content_access_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "content_access_events_share_link_id_idx" ON "content_access_events" USING btree ("share_link_id");--> statement-breakpoint
CREATE INDEX "content_audit_logs_space_id_idx" ON "content_audit_logs" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "content_audit_logs_content_uid_idx" ON "content_audit_logs" USING btree ("content_uid");--> statement-breakpoint
CREATE INDEX "content_audit_logs_actor_id_idx" ON "content_audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "content_audit_logs_action_idx" ON "content_audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "content_permissions_subject_unique" ON "content_permissions" USING btree ("content_uid","subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "content_permissions_space_id_idx" ON "content_permissions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "content_permissions_subject_lookup_idx" ON "content_permissions" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "content_registry_kind_local_id_unique" ON "content_registry" USING btree ("kind","local_id");--> statement-breakpoint
CREATE INDEX "content_registry_space_id_idx" ON "content_registry" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "content_registry_created_by_idx" ON "content_registry" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "content_share_links_token_hash_unique" ON "content_share_links" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "content_share_links_content_uid_idx" ON "content_share_links" USING btree ("content_uid");--> statement-breakpoint
CREATE INDEX "content_share_links_space_id_idx" ON "content_share_links" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "space_blobs_space_sha_unique" ON "space_blobs" USING btree ("space_id","sha256");--> statement-breakpoint
CREATE INDEX "space_blobs_status_idx" ON "space_blobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "space_blobs_created_by_idx" ON "space_blobs" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "space_members_user_id_idx" ON "space_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "space_members_role_idx" ON "space_members" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "space_members_owner_unique" ON "space_members" USING btree ("space_id") WHERE "space_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "spaces_created_by_idx" ON "spaces" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "spaces_kind_idx" ON "spaces" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "spaces_personal_owner_unique" ON "spaces" USING btree ("personal_owner_id") WHERE "spaces"."personal_owner_id" is not null;--> statement-breakpoint
CREATE INDEX "upload_sessions_space_id_idx" ON "upload_sessions" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_blob_id_idx" ON "upload_sessions" USING btree ("blob_id");--> statement-breakpoint
CREATE INDEX "upload_sessions_expires_at_idx" ON "upload_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "upload_sessions_status_idx" ON "upload_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "documents_source_idx" ON "documents" USING btree ("source");--> statement-breakpoint
CREATE INDEX "documents_file_type_idx" ON "documents" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "documents_source_type_idx" ON "documents" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_file_id_idx" ON "documents" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "documents_parent_id_idx" ON "documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "documents_source_set_id_idx" ON "documents" USING btree ("source_set_id");--> statement-breakpoint
CREATE INDEX "documents_space_id_idx" ON "documents" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "documents_content_uid_idx" ON "documents" USING btree ("content_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_client_id_space_id_unique" ON "documents" USING btree ("client_id","space_id") WHERE ("documents"."client_id" is not null and "documents"."deleted_at" is null);--> statement-breakpoint
CREATE UNIQUE INDEX "documents_slug_space_id_unique" ON "documents" USING btree ("slug","space_id") WHERE ("documents"."slug" is not null and "documents"."deleted_at" is null);--> statement-breakpoint
CREATE INDEX "file_hash_idx" ON "files" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "files_user_id_idx" ON "files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "files_space_id_idx" ON "files" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "files_content_uid_idx" ON "files" USING btree ("content_uid");--> statement-breakpoint
CREATE INDEX "files_blob_id_idx" ON "files" USING btree ("blob_id");--> statement-breakpoint
CREATE INDEX "files_parent_id_idx" ON "files" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "files_chunk_task_id_idx" ON "files" USING btree ("chunk_task_id");--> statement-breakpoint
CREATE INDEX "files_embedding_task_id_idx" ON "files" USING btree ("embedding_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "files_client_id_space_id_unique" ON "files" USING btree ("client_id","space_id");--> statement-breakpoint
CREATE INDEX "global_files_creator_idx" ON "global_files" USING btree ("creator");--> statement-breakpoint
CREATE INDEX "source_set_files_source_set_id_idx" ON "source_set_files" USING btree ("source_set_id");--> statement-breakpoint
CREATE INDEX "source_set_files_user_id_idx" ON "source_set_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "source_set_files_file_id_idx" ON "source_set_files" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "source_set_files_space_id_idx" ON "source_set_files" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_sets_client_id_space_id_unique" ON "source_sets" USING btree ("client_id","space_id");--> statement-breakpoint
CREATE INDEX "source_sets_user_id_idx" ON "source_sets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "source_sets_space_id_idx" ON "source_sets" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "source_sets_content_uid_idx" ON "source_sets" USING btree ("content_uid");--> statement-breakpoint
CREATE INDEX "generation_batches_user_id_idx" ON "generation_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_batches_topic_id_idx" ON "generation_batches" USING btree ("generation_topic_id");--> statement-breakpoint
CREATE INDEX "generation_topics_user_id_idx" ON "generation_topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generations_user_id_idx" ON "generations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generations_batch_id_idx" ON "generations" USING btree ("generation_batch_id");--> statement-breakpoint
CREATE INDEX "generations_file_id_idx" ON "generations" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "message_chunks_user_id_idx" ON "message_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_chunks_message_id_idx" ON "message_chunks" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_groups_client_id_user_id_unique" ON "message_groups" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "message_groups_user_id_idx" ON "message_groups" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_groups_topic_id_idx" ON "message_groups" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "message_groups_type_idx" ON "message_groups" USING btree ("type");--> statement-breakpoint
CREATE INDEX "message_groups_parent_group_id_idx" ON "message_groups" USING btree ("parent_group_id");--> statement-breakpoint
CREATE INDEX "message_groups_parent_message_id_idx" ON "message_groups" USING btree ("parent_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_plugins_client_id_user_id_unique" ON "message_plugins" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "message_plugins_user_id_idx" ON "message_plugins" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_plugins_tool_call_id_idx" ON "message_plugins" USING btree ("tool_call_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_queries_client_id_user_id_unique" ON "message_queries" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "message_queries_user_id_idx" ON "message_queries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_queries_message_id_idx" ON "message_queries" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_queries_embeddings_id_idx" ON "message_queries" USING btree ("embeddings_id");--> statement-breakpoint
CREATE INDEX "message_query_chunks_user_id_idx" ON "message_query_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "message_query_chunks_message_id_idx" ON "message_query_chunks" USING btree ("id");--> statement-breakpoint
CREATE INDEX "message_query_chunks_query_id_idx" ON "message_query_chunks" USING btree ("query_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_tts_client_id_user_id_unique" ON "message_tts" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "message_tts_user_id_idx" ON "message_tts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_translates_client_id_user_id_unique" ON "message_translates" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "message_translates_user_id_idx" ON "message_translates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_created_at_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "message_client_id_user_unique" ON "messages" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "messages_topic_id_idx" ON "messages" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "messages_parent_id_idx" ON "messages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "messages_quota_id_idx" ON "messages" USING btree ("quota_id");--> statement-breakpoint
CREATE INDEX "messages_user_id_idx" ON "messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_session_id_idx" ON "messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "messages_thread_id_idx" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "messages_agent_id_idx" ON "messages" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "messages_group_id_idx" ON "messages" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "messages_message_group_id_idx" ON "messages" USING btree ("message_group_id");--> statement-breakpoint
CREATE INDEX "messages_files_user_id_idx" ON "messages_files" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messages_files_message_id_idx" ON "messages_files" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "nextauth_accounts_user_id_idx" ON "nextauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nextauth_sessions_user_id_idx" ON "nextauth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oidc_access_tokens_user_id_idx" ON "oidc_access_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oidc_authorization_codes_user_id_idx" ON "oidc_authorization_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oidc_device_codes_user_id_idx" ON "oidc_device_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oidc_grants_user_id_idx" ON "oidc_grants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oidc_refresh_tokens_user_id_idx" ON "oidc_refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "oidc_sessions_user_id_idx" ON "oidc_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chunks_client_id_user_id_unique" ON "chunks" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "chunks_user_id_idx" ON "chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_chunks_chunk_id_idx" ON "document_chunks" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "document_chunks_user_id_idx" ON "document_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "embeddings_client_id_user_id_unique" ON "embeddings" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "embeddings_chunk_id_idx" ON "embeddings" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "embeddings_user_id_idx" ON "embeddings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unstructured_chunks_client_id_user_id_unique" ON "unstructured_chunks" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "unstructured_chunks_user_id_idx" ON "unstructured_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "unstructured_chunks_composite_id_idx" ON "unstructured_chunks" USING btree ("composite_id");--> statement-breakpoint
CREATE INDEX "unstructured_chunks_file_id_idx" ON "unstructured_chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "rag_eval_dataset_records_user_id_idx" ON "rag_eval_dataset_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rag_eval_datasets_user_id_idx" ON "rag_eval_datasets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rag_eval_evaluations_user_id_idx" ON "rag_eval_evaluations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rag_eval_evaluation_records_user_id_idx" ON "rag_eval_evaluation_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rbac_role_permissions_role_id_idx" ON "rbac_role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "rbac_role_permissions_permission_id_idx" ON "rbac_role_permissions" USING btree ("permission_id");--> statement-breakpoint
CREATE INDEX "rbac_user_roles_user_id_idx" ON "rbac_user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rbac_user_roles_role_id_idx" ON "rbac_user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "agents_to_sessions_session_id_idx" ON "agents_to_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "agents_to_sessions_agent_id_idx" ON "agents_to_sessions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agents_to_sessions_user_id_idx" ON "agents_to_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "file_chunks_user_id_idx" ON "file_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "file_chunks_file_id_idx" ON "file_chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_chunks_chunk_id_idx" ON "file_chunks" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "files_to_sessions_user_id_idx" ON "files_to_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "files_to_sessions_file_id_idx" ON "files_to_sessions" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "files_to_sessions_session_id_idx" ON "files_to_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_groups_client_id_user_id_unique" ON "session_groups" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "session_groups_user_id_idx" ON "session_groups" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_user_id_unique" ON "sessions" USING btree ("slug","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_client_id_user_id_unique" ON "sessions" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_id_user_id_idx" ON "sessions" USING btree ("id","user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_updated_at_idx" ON "sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "sessions_group_id_idx" ON "sessions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "space_memory_entries_space_id_idx" ON "space_memory_entries" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "space_memory_entries_space_status_idx" ON "space_memory_entries" USING btree ("space_id","status");--> statement-breakpoint
CREATE INDEX "space_memory_entries_space_category_idx" ON "space_memory_entries" USING btree ("space_id","category");--> statement-breakpoint
CREATE INDEX "space_memory_entries_space_recall_idx" ON "space_memory_entries" USING btree ("space_id","status","recall_enabled");--> statement-breakpoint
CREATE INDEX "space_memory_entries_expires_at_idx" ON "space_memory_entries" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "space_memory_entries_stale_at_idx" ON "space_memory_entries" USING btree ("stale_at");--> statement-breakpoint
CREATE INDEX "space_memory_entries_reviewed_by_idx" ON "space_memory_entries" USING btree ("reviewed_by");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_client_id_user_id_unique" ON "tags" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "tags_user_id_idx" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "threads_client_id_user_id_unique" ON "threads" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "threads_user_id_idx" ON "threads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "threads_topic_id_idx" ON "threads" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "threads_type_idx" ON "threads" USING btree ("type");--> statement-breakpoint
CREATE INDEX "threads_agent_id_idx" ON "threads" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "threads_group_id_idx" ON "threads" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "threads_parent_thread_id_idx" ON "threads" USING btree ("parent_thread_id");--> statement-breakpoint
CREATE INDEX "topic_documents_user_id_idx" ON "topic_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topic_documents_topic_id_idx" ON "topic_documents" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topic_documents_document_id_idx" ON "topic_documents" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_shares_topic_id_unique" ON "topic_shares" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topic_shares_user_id_idx" ON "topic_shares" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topics_client_id_user_id_unique" ON "topics" USING btree ("client_id","user_id");--> statement-breakpoint
CREATE INDEX "topics_user_id_idx" ON "topics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topics_id_user_id_idx" ON "topics" USING btree ("id","user_id");--> statement-breakpoint
CREATE INDEX "topics_session_id_idx" ON "topics" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "topics_tag_id_idx" ON "topics" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "topics_group_id_idx" ON "topics" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "topics_space_id_idx" ON "topics" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "topics_agent_id_idx" ON "topics" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "topics_trigger_idx" ON "topics" USING btree ("trigger");--> statement-breakpoint
CREATE INDEX "topics_extract_status_gin_idx" ON "topics" USING gin ((metadata->'userMemoryExtractStatus') jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "users_banned_true_created_at_idx" ON "users" USING btree ("created_at") WHERE "users"."banned" = true;--> statement-breakpoint
CREATE INDEX "user_memories_summary_vector_1024_index" ON "user_memories" USING hnsw ("summary_vector_1024" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_details_vector_1024_index" ON "user_memories" USING hnsw ("details_vector_1024" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_user_id_index" ON "user_memories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_activities_narrative_vector_index" ON "user_memories_activities" USING hnsw ("narrative_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_activities_feedback_vector_index" ON "user_memories_activities" USING hnsw ("feedback_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_activities_type_index" ON "user_memories_activities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "user_memories_activities_user_id_index" ON "user_memories_activities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_activities_user_memory_id_index" ON "user_memories_activities" USING btree ("user_memory_id");--> statement-breakpoint
CREATE INDEX "user_memories_activities_status_index" ON "user_memories_activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_memories_contexts_description_vector_index" ON "user_memories_contexts" USING hnsw ("description_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_contexts_type_index" ON "user_memories_contexts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "user_memories_contexts_user_id_index" ON "user_memories_contexts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_experiences_situation_vector_index" ON "user_memories_experiences" USING hnsw ("situation_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_experiences_action_vector_index" ON "user_memories_experiences" USING hnsw ("action_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_experiences_key_learning_vector_index" ON "user_memories_experiences" USING hnsw ("key_learning_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_experiences_type_index" ON "user_memories_experiences" USING btree ("type");--> statement-breakpoint
CREATE INDEX "user_memories_experiences_user_id_index" ON "user_memories_experiences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_experiences_user_memory_id_index" ON "user_memories_experiences" USING btree ("user_memory_id");--> statement-breakpoint
CREATE INDEX "user_memories_identities_description_vector_index" ON "user_memories_identities" USING hnsw ("description_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_identities_type_index" ON "user_memories_identities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "user_memories_identities_user_id_index" ON "user_memories_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_identities_user_memory_id_index" ON "user_memories_identities" USING btree ("user_memory_id");--> statement-breakpoint
CREATE INDEX "user_memories_preferences_conclusion_directives_vector_index" ON "user_memories_preferences" USING hnsw ("conclusion_directives_vector" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "user_memories_preferences_user_id_index" ON "user_memories_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_memories_preferences_user_memory_id_index" ON "user_memories_preferences" USING btree ("user_memory_id");--> statement-breakpoint
CREATE INDEX "user_persona_document_histories_persona_id_index" ON "user_memory_persona_document_histories" USING btree ("persona_id");--> statement-breakpoint
CREATE INDEX "user_persona_document_histories_user_id_index" ON "user_memory_persona_document_histories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_persona_document_histories_profile_index" ON "user_memory_persona_document_histories" USING btree ("profile");--> statement-breakpoint
CREATE UNIQUE INDEX "user_persona_documents_user_id_profile_unique" ON "user_memory_persona_documents" USING btree ("user_id","profile");--> statement-breakpoint
CREATE INDEX "user_persona_documents_user_id_index" ON "user_memory_persona_documents" USING btree ("user_id");
