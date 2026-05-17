-- Add Today Plan daily planning and reflection storage.
-- Safe to run multiple times.

BEGIN;

CREATE TABLE IF NOT EXISTS daily_plans (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  focus_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  energy_level TEXT NOT NULL DEFAULT 'medium' CHECK (energy_level IN ('low', 'medium', 'high')),
  available_focus_minutes INTEGER CHECK (
    available_focus_minutes IS NULL OR (available_focus_minutes >= 0 AND available_focus_minutes <= 1440)
  ),
  mood TEXT,
  day_type TEXT NOT NULL DEFAULT 'normal' CHECK (
    day_type IN ('normal', 'busy', 'travel', 'sick', 'school', 'work-heavy', 'recovery')
  ),
  reflection_went_well TEXT,
  reflection_did_not_go_well TEXT,
  reflection_improve_tomorrow TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date);

ALTER TABLE daily_plans
  ADD COLUMN IF NOT EXISTS energy_level TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS available_focus_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS day_type TEXT NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_plans_energy_level_check'
  ) THEN
    ALTER TABLE daily_plans
      ADD CONSTRAINT daily_plans_energy_level_check
      CHECK (energy_level IN ('low', 'medium', 'high'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_plans_available_focus_minutes_check'
  ) THEN
    ALTER TABLE daily_plans
      ADD CONSTRAINT daily_plans_available_focus_minutes_check
      CHECK (available_focus_minutes IS NULL OR (available_focus_minutes >= 0 AND available_focus_minutes <= 1440));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_plans_day_type_check'
  ) THEN
    ALTER TABLE daily_plans
      ADD CONSTRAINT daily_plans_day_type_check
      CHECK (day_type IN ('normal', 'busy', 'travel', 'sick', 'school', 'work-heavy', 'recovery'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_energy
  ON daily_plans(user_id, energy_level);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_day_type
  ON daily_plans(user_id, day_type);

COMMIT;
