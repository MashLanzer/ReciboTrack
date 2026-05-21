-- ============================================================
-- ReciboTrack — Schema inicial para Supabase PostgreSQL
-- Migración desde Firebase Firestore
--
-- Instrucciones:
--   1. Copia este SQL en Supabase Dashboard → SQL Editor
--   2. Ejecuta el script completo
--   3. Verifica que todas las tablas aparecen en Table Editor
-- ============================================================

-- ─── Profiles (reemplaza users/{uid}) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  uid              TEXT PRIMARY KEY,
  display_name     TEXT,
  email            TEXT,
  photo_url        TEXT,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  ui_prefs         JSONB NOT NULL DEFAULT '{}',
  webhook_url      TEXT,
  webhook_events   TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── User Directory (reemplaza userDirectory/{base64email}) ──────────────────
CREATE TABLE IF NOT EXISTS user_directory (
  email        TEXT PRIMARY KEY,
  uid          TEXT NOT NULL,
  display_name TEXT,
  photo_url    TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Expenses (reemplaza users/{uid}/expenses) ────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid               TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  account           TEXT NOT NULL DEFAULT 'personal',
  merchant          TEXT NOT NULL DEFAULT '',
  date              TIMESTAMPTZ NOT NULL,
  items             JSONB NOT NULL DEFAULT '[]',
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax               NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method    TEXT,
  reference         TEXT,
  category          TEXT NOT NULL DEFAULT '',
  currency          TEXT NOT NULL DEFAULT 'USD',
  notes             TEXT NOT NULL DEFAULT '',
  tags              TEXT[] NOT NULL DEFAULT '{}',
  receipt_image_url TEXT,
  project           TEXT,
  privacy           TEXT NOT NULL DEFAULT 'private',
  archived          BOOLEAN NOT NULL DEFAULT FALSE,
  flagged           BOOLEAN NOT NULL DEFAULT FALSE,
  flagged_at        TIMESTAMPTZ,
  recurring_id      UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_uid_date     ON expenses(uid, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_uid_category ON expenses(uid, category);
CREATE INDEX IF NOT EXISTS idx_expenses_uid_archived ON expenses(uid, archived);
CREATE INDEX IF NOT EXISTS idx_expenses_uid_flagged  ON expenses(uid, flagged);

-- ─── Categories (reemplaza users/{uid}/categories) ───────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  icon       TEXT,
  color      TEXT,
  emoji      TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_uid ON categories(uid);

-- ─── Budgets (reemplaza users/{uid}/budgets) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid           TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  category_id   TEXT NOT NULL,
  monthly_limit NUMERIC(12,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budgets_uid ON budgets(uid);

-- ─── Category Budgets (reemplaza users/{uid}/categoryBudgets) ────────────────
CREATE TABLE IF NOT EXISTS category_budgets (
  uid          TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  budget_key   TEXT NOT NULL,
  category_id  TEXT NOT NULL,
  month        TEXT NOT NULL,
  limit_amount NUMERIC(12,2),
  currency     TEXT NOT NULL DEFAULT 'USD',
  PRIMARY KEY (uid, budget_key)
);

-- ─── Recurring (reemplaza users/{uid}/recurring) ─────────────────────────────
CREATE TABLE IF NOT EXISTS recurring (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                    TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  merchant               TEXT NOT NULL DEFAULT '',
  category               TEXT,
  subtotal               NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax                    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method         TEXT,
  currency               TEXT NOT NULL DEFAULT 'USD',
  notes                  TEXT NOT NULL DEFAULT '',
  tags                   TEXT[] NOT NULL DEFAULT '{}',
  frequency              TEXT NOT NULL DEFAULT 'monthly',
  next_due_date          DATE,
  active                 BOOLEAN NOT NULL DEFAULT TRUE,
  notified_on            DATE,
  last_linked_expense_id UUID,
  last_linked_at         TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recurring_uid_active ON recurring(uid, active);
CREATE INDEX IF NOT EXISTS idx_recurring_uid_due    ON recurring(uid, next_due_date);

-- ─── Goals (reemplaza users/{uid}/goals) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid            TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'saving',
  name           TEXT NOT NULL,
  target_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  deadline       DATE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_uid ON goals(uid);

-- ─── Travel Budgets (reemplaza users/{uid}/travelBudgets) ────────────────────
CREATE TABLE IF NOT EXISTS travel_budgets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT,
  total_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'USD',
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_travel_budgets_uid ON travel_budgets(uid);

-- ─── Income (reemplaza users/{uid}/income) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS income (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid       TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  date      DATE NOT NULL,
  category  TEXT,
  amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  source    TEXT,
  notes     TEXT,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_uid_date ON income(uid, date DESC);

-- ─── Income Categories (reemplaza users/{uid}/incomeCategories) ──────────────
CREATE TABLE IF NOT EXISTS income_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  emoji      TEXT,
  color      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Push Subscriptions (reemplaza users/{uid}/meta/pushSub) ─────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  uid             TEXT PRIMARY KEY REFERENCES profiles(uid) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL,
  p256dh          TEXT,
  auth_key        TEXT,
  expiration_time BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Trusted Circle (reemplaza users/{uid}/trustedCircle) ────────────────────
CREATE TABLE IF NOT EXISTS trusted_circle (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid           TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  member_uid          TEXT,
  email               TEXT NOT NULL,
  display_name        TEXT,
  can_see_full_budget BOOLEAN NOT NULL DEFAULT FALSE,
  linked              BOOLEAN NOT NULL DEFAULT FALSE,
  added_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trusted_circle_owner ON trusted_circle(owner_uid);

-- ─── Quick Expenses (reemplaza users/{uid}/quickExpenses) ────────────────────
CREATE TABLE IF NOT EXISTS quick_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid            TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  merchant       TEXT,
  amount         NUMERIC(12,2),
  category       TEXT,
  currency       TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  icon           TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Category Rules (reemplaza users/{uid}/categoryRules) ────────────────────
CREATE TABLE IF NOT EXISTS category_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name        TEXT,
  field       TEXT NOT NULL,
  operator    TEXT NOT NULL,
  value       TEXT NOT NULL,
  category_id TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Clients (reemplaza users/{uid}/clients) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  notes      TEXT,
  color      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Templates (reemplaza users/{uid}/templates) ─────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid            TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  merchant       TEXT NOT NULL DEFAULT '',
  category       TEXT,
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total          NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  currency       TEXT NOT NULL DEFAULT 'USD',
  notes          TEXT NOT NULL DEFAULT '',
  tags           TEXT[] NOT NULL DEFAULT '{}',
  use_count      INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Automations (reemplaza users/{uid}/automations) ─────────────────────────
CREATE TABLE IF NOT EXISTS automations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid              TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  trigger_type     TEXT NOT NULL,
  trigger_value    NUMERIC,
  trigger_category TEXT,
  action_type      TEXT NOT NULL,
  action_value     TEXT,
  last_fired_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Portals (reemplaza users/{uid}/portals) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS portals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid          TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  token        TEXT UNIQUE NOT NULL,
  name         TEXT,
  categories   TEXT[] NOT NULL DEFAULT '{}',
  mask_amounts BOOLEAN NOT NULL DEFAULT FALSE,
  hide_dates   BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at   TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portals_token ON portals(token);

-- ─── User Settings (reemplaza users/{uid}/meta/settings) ─────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  uid  TEXT PRIMARY KEY REFERENCES profiles(uid) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'
);

-- ─── Pinned Items (reemplaza users/{uid}/pinnedItems/pinned) ─────────────────
CREATE TABLE IF NOT EXISTS pinned_items (
  uid   TEXT PRIMARY KEY REFERENCES profiles(uid) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'
);

-- ─── Starred (reemplaza users/{uid}/starred/data) ────────────────────────────
CREATE TABLE IF NOT EXISTS starred (
  uid        TEXT PRIMARY KEY REFERENCES profiles(uid) ON DELETE CASCADE,
  categories TEXT[] NOT NULL DEFAULT '{}',
  merchants  TEXT[] NOT NULL DEFAULT '{}'
);

-- ─── Watchlist (reemplaza users/{uid}/meta/watchlist) ────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
  uid        TEXT PRIMARY KEY REFERENCES profiles(uid) ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '[]'
);

-- ─── Project Budgets (reemplaza users/{uid}/settings/projectBudgets) ─────────
CREATE TABLE IF NOT EXISTS project_budgets (
  uid     TEXT PRIMARY KEY REFERENCES profiles(uid) ON DELETE CASCADE,
  budgets JSONB NOT NULL DEFAULT '{}'
);

-- ─── Entities (reemplaza users/{uid}/entities) ───────────────────────────────
CREATE TABLE IF NOT EXISTS entities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  name        TEXT NOT NULL,
  emoji       TEXT,
  color       TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  total_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  occurrences INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entities_uid ON entities(uid);

-- ─── Entity Edges (reemplaza users/{uid}/entityEdges) ────────────────────────
CREATE TABLE IF NOT EXISTS entity_edges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  from_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_id      UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  type       TEXT,
  expense_id UUID,
  weight     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_edges_uid ON entity_edges(uid);

-- ─── Highlights (reemplaza users/{uid}/highlights) ───────────────────────────
CREATE TABLE IF NOT EXISTS highlights (
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  type       TEXT,
  value      NUMERIC,
  metadata   JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (uid, key)
);

-- ─── Groups ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  emoji       TEXT,
  currency    TEXT NOT NULL DEFAULT 'USD',
  invite_code TEXT UNIQUE,
  members     JSONB NOT NULL DEFAULT '[]',
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by           TEXT NOT NULL,
  merchant          TEXT NOT NULL DEFAULT '',
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  category          TEXT,
  split_type        TEXT NOT NULL DEFAULT 'equal',
  participants      JSONB NOT NULL DEFAULT '[]',
  date              TIMESTAMPTZ NOT NULL,
  notes             TEXT,
  receipt_image_url TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_expenses_group ON group_expenses(group_id);

CREATE TABLE IF NOT EXISTS group_settlements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  from_uid   TEXT NOT NULL,
  to_uid     TEXT NOT NULL,
  amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency   TEXT NOT NULL DEFAULT 'USD',
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  date        TIMESTAMPTZ NOT NULL,
  rsvps       JSONB NOT NULL DEFAULT '{}',
  total_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  options    JSONB NOT NULL DEFAULT '[]',
  status     TEXT NOT NULL DEFAULT 'open',
  closed_at  TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_checklists (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  items      JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_wishlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  url             TEXT,
  estimated_price NUMERIC(12,2),
  currency        TEXT NOT NULL DEFAULT 'USD',
  added_by        TEXT NOT NULL,
  likes           TEXT[] NOT NULL DEFAULT '{}',
  purchased       BOOLEAN NOT NULL DEFAULT FALSE,
  purchased_by    TEXT,
  purchased_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS group_bets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  period       TEXT NOT NULL DEFAULT 'month',
  participants JSONB NOT NULL DEFAULT '[]',
  amounts      JSONB NOT NULL DEFAULT '{}',
  winner       TEXT,
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES group_expenses(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  emoji      TEXT NOT NULL,
  UNIQUE(expense_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS group_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES group_expenses(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
