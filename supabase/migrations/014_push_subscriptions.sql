CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  keys       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subs_uid_idx ON push_subscriptions(uid);
