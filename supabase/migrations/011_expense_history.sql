CREATE TABLE IF NOT EXISTS expense_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  uid         TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  field       TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT
);

CREATE INDEX IF NOT EXISTS expense_history_expense_id_idx ON expense_history(expense_id);
CREATE INDEX IF NOT EXISTS expense_history_uid_idx ON expense_history(uid);
