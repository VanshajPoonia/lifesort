-- Add profile fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP;

-- Create user content preferences table
CREATE TABLE IF NOT EXISTS user_content_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, content_type)
);

-- Create daily content table (stores quotes, jokes, games shown to users)
CREATE TABLE IF NOT EXISTS daily_content (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  title VARCHAR(255),
  content TEXT NOT NULL,
  shown_date DATE NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_content_user_date ON daily_content(user_id, shown_date);
CREATE INDEX IF NOT EXISTS idx_daily_content_type ON daily_content(content_type);

-- Insert default content preferences for existing users
INSERT INTO user_content_preferences (user_id, content_type, enabled)
SELECT id, 'motivational_quotes', true FROM users
ON CONFLICT (user_id, content_type) DO NOTHING;

INSERT INTO user_content_preferences (user_id, content_type, enabled)
SELECT id, 'funny_jokes', true FROM users
ON CONFLICT (user_id, content_type) DO NOTHING;

INSERT INTO user_content_preferences (user_id, content_type, enabled)
SELECT id, 'religious_quotes', false FROM users
ON CONFLICT (user_id, content_type) DO NOTHING;

INSERT INTO user_content_preferences (user_id, content_type, enabled)
SELECT id, 'dank_jokes', false FROM users
ON CONFLICT (user_id, content_type) DO NOTHING;

INSERT INTO user_content_preferences (user_id, content_type, enabled)
SELECT id, 'mini_games', true FROM users
ON CONFLICT (user_id, content_type) DO NOTHING;
