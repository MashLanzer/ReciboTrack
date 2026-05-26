-- Payment handles for shareable pay links (PayPal.me, Venmo, Cash App).
-- Stored on profile so a user configures them once and they auto-fill into
-- every /pay/[token] link they generate.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS paypal_handle    TEXT,
  ADD COLUMN IF NOT EXISTS venmo_handle     TEXT,
  ADD COLUMN IF NOT EXISTS cashapp_cashtag  TEXT;
