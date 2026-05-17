-- Add subscription fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 day'),
ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;

-- Update existing users to have trial_ends_at set
UPDATE users 
SET trial_ends_at = created_at + INTERVAL '1 day'
WHERE trial_ends_at IS NULL;
