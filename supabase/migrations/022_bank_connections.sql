-- Bank connections via Belvo Open Banking
CREATE TABLE IF NOT EXISTS bank_connections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid             TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  belvo_link_id   TEXT UNIQUE NOT NULL,
  institution     TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'valid',
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_connections_uid_idx ON bank_connections(uid);

-- Synced transactions from bank
CREATE TABLE IF NOT EXISTS bank_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid             TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  connection_id   UUID NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  belvo_txn_id    TEXT UNIQUE NOT NULL,
  expense_id      UUID REFERENCES expenses(id) ON DELETE SET NULL,
  merchant        TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  date            DATE NOT NULL,
  category        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',
  raw_data        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_txn_uid_idx ON bank_transactions(uid);
CREATE INDEX IF NOT EXISTS bank_txn_connection_idx ON bank_transactions(connection_id);
