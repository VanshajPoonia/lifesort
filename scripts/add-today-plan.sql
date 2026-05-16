-- Add Today Plan daily planning and reflection storage.
-- Safe to run multiple times.

BEGIN;

CREATE TABLE IF NOT EXISTS daily_plans (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  focus_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  reflection_went_well TEXT,
  reflection_did_not_go_well TEXT,
  reflection_improve_tomorrow TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date);

COMMIT;
