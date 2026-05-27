CREATE TABLE IF NOT EXISTS webhooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  secret     TEXT,
  events     TEXT[] NOT NULL DEFAULT '{"expense.created","expense.updated"}',
  enabled    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_fired TIMESTAMPTZ,
  last_status INTEGER
);
CREATE INDEX IF NOT EXISTS webhooks_uid_idx ON webhooks(uid);
