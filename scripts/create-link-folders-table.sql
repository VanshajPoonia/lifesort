-- Create link_folders table for user-specific folders
CREATE TABLE IF NOT EXISTS link_folders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) DEFAULT 'bg-primary',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster user-specific queries
CREATE INDEX IF NOT EXISTS idx_link_folders_user_id ON link_folders(user_id);
