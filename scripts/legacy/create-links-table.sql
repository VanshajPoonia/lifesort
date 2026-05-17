-- Create user_links table for Linktree-style functionality
CREATE TABLE IF NOT EXISTS user_links (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_links_user_id ON user_links(user_id);
