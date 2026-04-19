CREATE TABLE IF NOT EXISTS releases (
  id BIGSERIAL PRIMARY KEY,
  runtime_version TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  timestamp TIMESTAMPTZ NOT NULL,
  commit_hash TEXT NOT NULL,
  commit_message TEXT,
  update_id UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_releases_runtime_version_timestamp
  ON releases (runtime_version, timestamp DESC);

CREATE TABLE IF NOT EXISTS releases_tracking (
  id BIGSERIAL PRIMARY KEY,
  release_id BIGINT NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  download_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_releases_tracking_release_id
  ON releases_tracking (release_id);
