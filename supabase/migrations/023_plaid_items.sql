-- ════════════════════════════════════════════════════════════════════════
-- Plaid bank sync — items, accounts, and transaction linkage
-- ════════════════════════════════════════════════════════════════════════

-- A "Plaid item" represents one connected institution per user.
-- One user can connect multiple banks. One item can have multiple accounts
-- (checking, savings, credit card, etc.).
CREATE TABLE IF NOT EXISTS plaid_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid               TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  plaid_item_id     TEXT NOT NULL UNIQUE,
  access_token      TEXT NOT NULL,
  institution_id    TEXT,
  institution_name  TEXT,
  cursor            TEXT,
  last_synced_at    TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'error', 'disconnected')),
  error_code        TEXT,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plaid_items_uid ON plaid_items(uid);

-- Individual accounts within a Plaid item (e.g. "Chase Checking …1234").
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id             UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  uid                 TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  plaid_account_id    TEXT NOT NULL UNIQUE,
  name                TEXT,
  official_name       TEXT,
  mask                TEXT,
  type                TEXT,
  subtype             TEXT,
  current_balance     NUMERIC(14,2),
  available_balance   NUMERIC(14,2),
  currency            TEXT,
  hidden              BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item ON plaid_accounts(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_uid  ON plaid_accounts(uid);

-- Link imported transactions back to their Plaid source so we never double-insert
-- and can mark them up in the UI ("auto-imported from <bank>").
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS plaid_account_id     TEXT,
  ADD COLUMN IF NOT EXISTS source               TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'plaid', 'csv', 'recurring'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_plaid_tx
  ON expenses(uid, plaid_transaction_id)
  WHERE plaid_transaction_id IS NOT NULL;
