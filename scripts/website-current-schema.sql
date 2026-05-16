-- LifeSort website canonical schema baseline
-- This file reflects the tables and columns expected by the current website API.
-- Run after reviewing existing production schema; older patch scripts contain drift.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone VARCHAR(30),
  location VARCHAR(255),
  date_of_birth DATE,
  trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '1 day'),
  is_subscribed BOOLEAN DEFAULT FALSE,
  subscription_ends_at TIMESTAMP,
  subscription_end_date TIMESTAMP,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  is_admin BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  app_preferences JSONB DEFAULT '{}'::jsonb,
  sidebar_preferences JSONB DEFAULT '{}'::jsonb,
  refresh_count_today INTEGER DEFAULT 0,
  last_refresh_date DATE,
  last_investment_fetch TIMESTAMP,
  investments_last_fetched TIMESTAMP,
  investments_fetch_priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'personal',
  target_date DATE,
  progress INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  priority VARCHAR(50) DEFAULT 'medium',
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  value_unit VARCHAR(50),
  email_reminder BOOLEAN DEFAULT TRUE,
  reminder_days INTEGER DEFAULT 3,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  due_date DATE,
  due_time TIME,
  reminder_at TIMESTAMP,
  completed BOOLEAN DEFAULT FALSE,
  category VARCHAR(100),
  highlight_of_day BOOLEAN DEFAULT FALSE,
  email_reminder BOOLEAN DEFAULT FALSE,
  reminder_days INTEGER DEFAULT 1,
  reminder_sent BOOLEAN DEFAULT FALSE,
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nuke_goals (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  deadline DATE,
  milestones JSONB DEFAULT '[]'::jsonb,
  completed BOOLEAN DEFAULT FALSE,
  email_reminder BOOLEAN DEFAULT TRUE,
  reminder_days INTEGER DEFAULT 3,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  category VARCHAR(50) DEFAULT 'personal',
  location VARCHAR(255),
  attendees VARCHAR(255),
  email_reminder BOOLEAN DEFAULT FALSE,
  reminder_days INTEGER DEFAULT 1,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendar_integrations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  calendar_email VARCHAR(255),
  email VARCHAR(255),
  calendar_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE TABLE IF NOT EXISTS note_folders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) DEFAULT 'Untitled',
  content TEXT DEFAULT '',
  folder_id INTEGER REFERENCES note_folders(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS link_folders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) DEFAULT 'bg-primary',
  parent_id INTEGER REFERENCES link_folders(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT FALSE,
  share_token VARCHAR(64),
  share_permission VARCHAR(20) DEFAULT 'private',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_links (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  url TEXT DEFAULT '',
  description TEXT,
  folder_id TEXT,
  thumbnail TEXT,
  position INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  share_token VARCHAR(64),
  share_permission VARCHAR(20) DEFAULT 'private',
  link_type VARCHAR(20) DEFAULT 'link',
  file_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(12, 2),
  url TEXT,
  image_url TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  category VARCHAR(100) DEFAULT 'general',
  purchased BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  symbol VARCHAR(50),
  amount DECIMAL(15, 2) DEFAULT 0,
  current_value DECIMAL(15, 2),
  cached_price DECIMAL(15, 2),
  last_price_fetch TIMESTAMP,
  purchase_date DATE,
  notes TEXT,
  estimated_return_rate DECIMAL(5, 2) DEFAULT 0,
  wishlist_item_id INTEGER REFERENCES wishlist_items(id) ON DELETE SET NULL,
  quantity DECIMAL(20, 8),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS income_sources (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_name VARCHAR(255) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  frequency VARCHAR(50) DEFAULT 'monthly',
  category VARCHAR(100),
  next_payment_date DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#3B82F6',
  icon VARCHAR(50) DEFAULT 'folder',
  budget_limit DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES budget_categories(id) ON DELETE SET NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency VARCHAR(20),
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_goals (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  target_amount DECIMAL(12, 2) NOT NULL,
  current_amount DECIMAL(12, 2) DEFAULT 0,
  deadline DATE,
  category_id INTEGER REFERENCES budget_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_content_preferences (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  quote_types TEXT[] DEFAULT ARRAY['motivational'],
  joke_types TEXT[] DEFAULT ARRAY['funny'],
  show_quotes BOOLEAN DEFAULT TRUE,
  show_jokes BOOLEAN DEFAULT TRUE,
  show_games BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_content (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  title VARCHAR(255),
  content TEXT NOT NULL,
  extra_data JSONB DEFAULT '{}'::jsonb,
  shown_at TIMESTAMP DEFAULT NOW(),
  shown_date DATE GENERATED ALWAYS AS (shown_at::date) STORED,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_sections (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  icon VARCHAR(50) DEFAULT 'Folder',
  color VARCHAR(50) DEFAULT 'primary',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_section_items (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES custom_sections(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_usage (
  id SERIAL PRIMARY KEY,
  api_name VARCHAR(100) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER DEFAULT 0,
  max_requests INTEGER DEFAULT 25,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(api_name, date)
);

CREATE TABLE IF NOT EXISTS popular_investments (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  region VARCHAR(50) DEFAULT 'US',
  currency VARCHAR(10) DEFAULT 'USD',
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_reminder_at ON tasks(reminder_at);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_note_folders_user_name ON note_folders(user_id, name);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON notes(user_id, is_pinned, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_user_links_user_id ON user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_link_folders_user_id ON link_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_income_user_id ON income_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_transactions_user_date ON budget_transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_content_user_shown ON daily_content(user_id, shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_folders_share_token ON link_folders(share_token);
CREATE INDEX IF NOT EXISTS idx_user_links_share_token ON user_links(share_token);
