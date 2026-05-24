-- Add price history array to recurring templates
ALTER TABLE recurring ADD COLUMN IF NOT EXISTS price_history JSONB NOT NULL DEFAULT '[]';
