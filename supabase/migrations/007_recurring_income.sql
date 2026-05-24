CREATE TABLE IF NOT EXISTS recurring_income (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid           TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  description   TEXT NOT NULL DEFAULT '',
  source        TEXT NOT NULL DEFAULT 'Otro',
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  frequency     TEXT NOT NULL DEFAULT 'monthly',  -- monthly, biweekly, weekly, yearly
  next_due_date DATE NOT NULL,
  account       TEXT NOT NULL DEFAULT 'personal',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_income_uid_idx ON recurring_income(uid);
