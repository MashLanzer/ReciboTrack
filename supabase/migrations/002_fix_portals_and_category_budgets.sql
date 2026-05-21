-- ============================================================
-- Migración 002 — Corregir tablas portals y category_budgets
-- para que coincidan con los tipos reales del cliente
--
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── Portals — recrear con el esquema completo ────────────────────────────────
DROP TABLE IF EXISTS portals CASCADE;

CREATE TABLE portals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid              TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  token            TEXT UNIQUE NOT NULL,
  name             TEXT,
  role             TEXT NOT NULL DEFAULT 'custom',
  permissions      JSONB NOT NULL DEFAULT '{}',
  expires_at       TIMESTAMPTZ,
  revoked          BOOLEAN NOT NULL DEFAULT FALSE,
  last_accessed_at TIMESTAMPTZ,
  access_count     INTEGER NOT NULL DEFAULT 0,
  target_label     TEXT NOT NULL DEFAULT '',
  owner_name       TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portals_uid ON portals(uid);
CREATE INDEX idx_portals_token ON portals(token);

-- ─── Category Budgets — ajustar nombre de columna ────────────────────────────
-- El cliente usa 'amount', el schema original tenía 'limit_amount'
ALTER TABLE category_budgets
  RENAME COLUMN limit_amount TO amount;

-- Añadir columna id autoincremental para compatibilidad con el hook
-- (que usa el id del documento como string en Firestore)
ALTER TABLE category_budgets
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Cambiar budget_key para permitir el formato "categoryId_YYYY-MM" de Firestore
COMMENT ON COLUMN category_budgets.budget_key IS 'Formato: {categoryId}_{YYYY-MM}';
