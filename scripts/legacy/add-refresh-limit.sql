-- Add refresh tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_count_today INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_refresh_date DATE;
