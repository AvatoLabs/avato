CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY,
  space_id TEXT REFERENCES spaces(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  expected_size INTEGER NOT NULL,
  expected_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  etag TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX upload_sessions_space_id_idx ON upload_sessions(space_id);
CREATE INDEX upload_sessions_expires_at_idx ON upload_sessions(expires_at);
CREATE INDEX upload_sessions_status_idx ON upload_sessions(status);
