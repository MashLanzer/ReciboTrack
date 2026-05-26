-- Add optional note to group_settlements so users can describe each payment.
ALTER TABLE group_settlements
  ADD COLUMN IF NOT EXISTS note TEXT;
