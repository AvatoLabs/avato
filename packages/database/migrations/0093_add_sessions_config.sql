-- Add session-level agent config for session-only chats (no linked agent)
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "config" jsonb;