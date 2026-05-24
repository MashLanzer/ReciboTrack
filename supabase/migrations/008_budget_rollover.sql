-- Add rollover support to budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS rollover_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Store monthly rollover amounts per budget
CREATE TABLE IF NOT EXISTS budget_rollover (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  budget_id   UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  month       TEXT NOT NULL,  -- "YYYY-MM"
  surplus     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- positive = unspent, negative = overspent
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(budget_id, month)
);
CREATE INDEX IF NOT EXISTS budget_rollover_uid_idx ON budget_rollover(uid);
