-- Complete Goals feature fields and optional task linking.
-- Safe to run more than once on the LifeSort website database.

ALTER TABLE goals ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'personal';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_value NUMERIC;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS current_value NUMERIC DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS value_unit VARCHAR(50);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS email_reminder BOOLEAN DEFAULT TRUE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS reminder_days INTEGER DEFAULT 3;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE goals ALTER COLUMN status SET DEFAULT 'active';
UPDATE goals SET status = 'active' WHERE status = 'in_progress';
UPDATE goals SET priority = 'medium' WHERE priority IS NULL;
UPDATE goals SET category = 'personal' WHERE category IS NULL;
UPDATE goals SET progress = 0 WHERE progress IS NULL;
UPDATE goals SET reminder_days = 3 WHERE reminder_days IS NULL;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_goals_category ON goals(category);
CREATE INDEX IF NOT EXISTS idx_tasks_goal_id ON tasks(goal_id);
