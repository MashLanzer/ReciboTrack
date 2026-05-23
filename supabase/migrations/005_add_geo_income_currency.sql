-- ============================================================
-- Migración 005 — Columnas faltantes y soporte geo en expenses
-- ============================================================
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── income: añadir currency y account ───────────────────────────────────────
ALTER TABLE income
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS account  TEXT;

-- ─── expenses: columnas de geolocalización ───────────────────────────────────
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS geo_lat          NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS geo_lng          NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS geo_accuracy     NUMERIC,
  ADD COLUMN IF NOT EXISTS geo_city         TEXT,
  ADD COLUMN IF NOT EXISTS geo_country_code TEXT;

CREATE INDEX IF NOT EXISTS idx_expenses_geo
  ON expenses(uid) WHERE geo_lat IS NOT NULL;

-- ─── portals: añadir columnas del esquema extendido (idempotente) ─────────────
-- (Seguro tanto si migration 002 fue aplicada como si no)
ALTER TABLE portals
  ADD COLUMN IF NOT EXISTS role             TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS permissions      JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS revoked          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS target_label     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS owner_name       TEXT NOT NULL DEFAULT '';

-- ─── category_budgets: renombrar limit_amount → amount si aún no se hizo ─────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'category_budgets' AND column_name = 'limit_amount'
  ) THEN
    ALTER TABLE category_budgets RENAME COLUMN limit_amount TO amount;
  END IF;
END $$;

-- Garantizar que la columna amount existe (no-op si ya existe tras el rename)
ALTER TABLE category_budgets
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS id     UUID DEFAULT gen_random_uuid();
