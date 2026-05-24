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
