-- ─── Handle público ──────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS handle TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(lower(handle));

-- ─── Stripe ──────────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                      TEXT NOT NULL REFERENCES profiles(uid) ON DELETE CASCADE,
  stripe_session_id        TEXT,
  stripe_subscription_id   TEXT,
  stripe_customer_id       TEXT,
  status                   TEXT NOT NULL DEFAULT 'pending',
  plan                     TEXT NOT NULL DEFAULT 'pro',
  period_start             TIMESTAMPTZ,
  period_end               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_sub_id ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_uid ON subscriptions(uid);
