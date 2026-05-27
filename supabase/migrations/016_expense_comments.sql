CREATE TABLE IF NOT EXISTS expense_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  uid        TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expense_comments_expense_id_idx ON expense_comments(expense_id);
CREATE INDEX IF NOT EXISTS expense_comments_uid_idx ON expense_comments(uid);
