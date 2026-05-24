-- ============================================================
-- Migración 006 — Cambiar categories.id y income_categories.id
-- de UUID a TEXT para soportar slugs como "combustible", "comida", etc.
--
-- Las categorías en Firestore usan slugs como IDs (no UUIDs).
-- Los gastos referencian categorías por slug string en expenses.category.
--
-- Ejecutar en Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── categories: id UUID → TEXT ──────────────────────────────────────────────
-- Primero eliminar el default UUID y cambiar el tipo
ALTER TABLE categories
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE categories
  ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- ─── income_categories: id UUID → TEXT ───────────────────────────────────────
ALTER TABLE income_categories
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE income_categories
  ALTER COLUMN id TYPE TEXT USING id::TEXT;
