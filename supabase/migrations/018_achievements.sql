CREATE TABLE IF NOT EXISTS user_achievements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid          TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  achievement  TEXT NOT NULL,
  earned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(uid, achievement)
);
CREATE INDEX IF NOT EXISTS user_achievements_uid_idx ON user_achievements(uid);

-- Streak tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_expense_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0;
