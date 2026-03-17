-- Add folder_id and thumbnail columns to user_links table
ALTER TABLE user_links ADD COLUMN IF NOT EXISTS folder_id TEXT;
ALTER TABLE user_links ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE user_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
