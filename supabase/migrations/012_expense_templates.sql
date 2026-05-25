CREATE TABLE IF NOT EXISTS expense_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  merchant    TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'Otros',
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency    TEXT NOT NULL DEFAULT 'USD',
  account     TEXT NOT NULL DEFAULT 'personal',
  notes       TEXT NOT NULL DEFAULT '',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  icon        TEXT NOT NULL DEFAULT '📌',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expense_templates_uid_idx ON expense_templates(uid);
