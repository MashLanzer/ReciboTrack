-- ─── Extender tabla groups ──────────────────────────────────────────────────
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS budget       NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS type         TEXT,
  ADD COLUMN IF NOT EXISTS admin_uid    TEXT,
  ADD COLUMN IF NOT EXISTS member_uids  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invite_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ;

-- members ya existe como JSONB en el schema original
-- invite_code ya existe (single code); invite_codes es el array

CREATE INDEX IF NOT EXISTS idx_groups_member_uids ON groups USING GIN(member_uids);

-- ─── Extender tabla group_expenses ──────────────────────────────────────────
ALTER TABLE group_expenses
  ADD COLUMN IF NOT EXISTS paid_by_name  TEXT,
  ADD COLUMN IF NOT EXISTS items         JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax           NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference     TEXT,
  ADD COLUMN IF NOT EXISTS tags          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS split_with    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_shares JSONB,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- ─── Extender tabla group_events ────────────────────────────────────────────
ALTER TABLE group_events
  ADD COLUMN IF NOT EXISTS title        TEXT,
  ADD COLUMN IF NOT EXISTS total_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency     TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS split_method TEXT NOT NULL DEFAULT 'equal',
  ADD COLUMN IF NOT EXISTS attendees    TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by   TEXT,
  ADD COLUMN IF NOT EXISTS settled      BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── Extender tabla group_polls ─────────────────────────────────────────────
ALTER TABLE group_polls
  ADD COLUMN IF NOT EXISTS question     TEXT,
  ADD COLUMN IF NOT EXISTS result       TEXT,
  ADD COLUMN IF NOT EXISTS split_method TEXT,
  ADD COLUMN IF NOT EXISTS closes_at    TIMESTAMPTZ;

-- created_by ya existe, title se usa como question si no existe question

-- ─── Extender tabla group_wishlist ──────────────────────────────────────────
-- La tabla ya tiene: title, url, estimated_price, currency, added_by, likes, purchased, purchased_by, purchased_at
-- Solo verificamos que likes sea TEXT[] (ya lo es en el schema original)

-- ─── Extender tabla group_notes ─────────────────────────────────────────────
-- La tabla ya tiene: id, group_id, user_id, text, created_at, expires_at
-- OK tal como está

-- ─── Extender tabla group_checklists ────────────────────────────────────────
ALTER TABLE group_checklists
  ADD COLUMN IF NOT EXISTS created_by_uid TEXT;

-- ─── Extender tabla group_bets ──────────────────────────────────────────────
ALTER TABLE group_bets
  ADD COLUMN IF NOT EXISTS creator_id    TEXT,
  ADD COLUMN IF NOT EXISTS creator_name  TEXT,
  ADD COLUMN IF NOT EXISTS category      TEXT,
  ADD COLUMN IF NOT EXISTS target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency      TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS stake         TEXT,
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS result_data   JSONB,    -- { winnerId, winnerName, actualAmount }
  ADD COLUMN IF NOT EXISTS ends_at       TIMESTAMPTZ;

-- ─── Extender tabla group_folders ───────────────────────────────────────────
ALTER TABLE group_folders
  ADD COLUMN IF NOT EXISTS created_by_uid TEXT;

-- ─── Extender tabla group_comments ──────────────────────────────────────────
ALTER TABLE group_comments
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS photo_url    TEXT;

-- ─── Audit log para group_expenses ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_expense_audit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES group_expenses(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,     -- 'created' | 'updated' | 'deleted'
  by_uid     TEXT NOT NULL,
  by_name    TEXT NOT NULL,
  summary    TEXT NOT NULL,
  timestamp  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_expense ON group_expense_audit(expense_id);
