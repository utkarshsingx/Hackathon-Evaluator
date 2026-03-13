-- Add last_evaluated_at to track when AI evaluations were run
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;
