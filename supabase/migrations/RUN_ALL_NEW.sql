-- ============================================================
-- Ejecutar en Supabase → SQL Editor (pegar todo de una vez)
-- ============================================================

-- ─── 007: Ingresos recurrentes ────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_income (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid           TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  description   TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT 'Otro',
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  frequency     TEXT NOT NULL DEFAULT 'monthly',
  next_due_date DATE NOT NULL,
  account       TEXT NOT NULL DEFAULT 'personal',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_income_uid_idx ON recurring_income(uid);

-- ─── 008: Presupuesto con rollover ───────────────────────

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS rollover_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS budget_rollover (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  budget_id   UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,
  surplus     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(budget_id, month)
);

CREATE INDEX IF NOT EXISTS budget_rollover_uid_idx ON budget_rollover(uid);

-- ─── 009: Historial de precios en recurrentes ────────────

ALTER TABLE recurring ADD COLUMN IF NOT EXISTS price_history JSONB NOT NULL DEFAULT '[]';

-- ─── 010: Proyectos independientes + project_id en gastos

CREATE TABLE IF NOT EXISTS projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid          TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
  description  TEXT,
  budget       NUMERIC(12,2),
  currency     TEXT NOT NULL DEFAULT 'USD',
  status       TEXT NOT NULL DEFAULT 'active',
  color        TEXT NOT NULL DEFAULT '#6366f1',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_uid_idx ON projects(uid);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects(client_id);

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS expenses_project_id_idx ON expenses(project_id);

-- ─── 021: Webhooks salientes ──────────────────────────────

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

-- ─── 020: Handle público + Stripe ────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS handle TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(lower(handle));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                      TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  stripe_session_id        TEXT,
  stripe_subscription_id   TEXT,
  stripe_customer_id       TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending',
  plan                     TEXT NOT NULL DEFAULT 'pro',
  period_start             TIMESTAMPTZ,
  period_end               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_sub_id ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_uid ON subscriptions(uid);

-- ─── 022: Conexiones bancarias (Belvo Open Banking) ──────
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
