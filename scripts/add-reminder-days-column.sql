-- Add reminder_days column to goals table
ALTER TABLE goals ADD COLUMN IF NOT EXISTS reminder_days INTEGER DEFAULT 3;

-- Add reminder columns to nuke_goals table
ALTER TABLE nuke_goals ADD COLUMN IF NOT EXISTS email_reminder BOOLEAN DEFAULT true;
ALTER TABLE nuke_goals ADD COLUMN IF NOT EXISTS reminder_days INTEGER DEFAULT 3;
ALTER TABLE nuke_goals ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Add reminder columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS email_reminder BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_days INTEGER DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Add reminder columns to calendar_events table (create if not exists)
CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME,
  category VARCHAR(50) DEFAULT 'personal',
  location VARCHAR(255),
  attendees VARCHAR(255),
  email_reminder BOOLEAN DEFAULT false,
  reminder_days INTEGER DEFAULT 1,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
