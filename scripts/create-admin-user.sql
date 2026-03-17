-- Add subscription columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 day');
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_subscribed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create admin user with hashed password for "admin123"
-- Password hash for "admin123" using SHA-256: 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
INSERT INTO users (email, password_hash, name, is_admin, trial_ends_at, is_subscribed, subscription_ends_at)
VALUES (
  'admin@lifesort.com',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'Super Admin',
  true,
  NOW() + INTERVAL '100 years',
  true,
  NOW() + INTERVAL '100 years'
)
ON CONFLICT (email) DO UPDATE 
SET is_admin = true,
    is_subscribed = true,
    subscription_ends_at = NOW() + INTERVAL '100 years';

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
