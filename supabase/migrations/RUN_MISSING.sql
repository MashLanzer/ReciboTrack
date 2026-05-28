-- ============================================================
-- Ejecutar en Supabase → SQL Editor después de RUN_ALL_NEW.sql
-- Cubre las migraciones 023, 024 y 025 que faltaban
-- ============================================================

-- ─── 023: Plaid bank sync — items, cuentas y link de transacciones ───────────

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

-- Columnas en expenses para identificar transacciones importadas por Plaid
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS plaid_account_id     TEXT,
  ADD COLUMN IF NOT EXISTS source               TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'plaid', 'csv', 'recurring'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_plaid_tx
  ON expenses(uid, plaid_transaction_id)
  WHERE plaid_transaction_id IS NOT NULL;

-- ─── 024: Logo y color de institución en plaid_items ─────────────────────────

ALTER TABLE plaid_items
  ADD COLUMN IF NOT EXISTS logo           TEXT,
  ADD COLUMN IF NOT EXISTS primary_color  TEXT;

-- ─── 025: Tres planes — Free, Pro, Premium ────────────────────────────────────

-- Quitar la constraint vieja (solo tenía free/pro)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;

-- Nueva constraint con los 3 tiers
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'pro', 'premium'));

-- Migrar usuarios 'pro' existentes a 'premium' (pagaban $4.99, mantienen acceso)
UPDATE profiles SET plan = 'premium' WHERE plan = 'pro';
