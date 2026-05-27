CREATE TABLE IF NOT EXISTS passkeys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid           TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key    TEXT NOT NULL,
  counter       INTEGER NOT NULL DEFAULT 0,
  device_name   TEXT NOT NULL DEFAULT 'Dispositivo',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passkeys_uid_idx ON passkeys(uid);
