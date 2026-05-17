-- Add Energy and Capacity Planner fields to Today Plan.
-- Safe to run multiple times.

BEGIN;

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
