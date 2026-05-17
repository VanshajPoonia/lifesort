-- Add Personal Operating Rules and visible AI planning preferences.
-- Safe to run multiple times. Do not run without confirming the target database.

CREATE TABLE IF NOT EXISTS personal_rules (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (
    category IN ('time', 'energy', 'work', 'health', 'finance', 'learning', 'relationships', 'planning', 'AI', 'other')
  ),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  rule_type VARCHAR(30) NOT NULL DEFAULT 'rule' CHECK (rule_type IN ('rule', 'preferences')),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_rules_user_preferences
  ON personal_rules(user_id)
  WHERE rule_type = 'preferences';

CREATE INDEX IF NOT EXISTS idx_personal_rules_user_active
  ON personal_rules(user_id, active);

CREATE INDEX IF NOT EXISTS idx_personal_rules_user_category
  ON personal_rules(user_id, category);

CREATE INDEX IF NOT EXISTS idx_personal_rules_user_type
  ON personal_rules(user_id, rule_type);
