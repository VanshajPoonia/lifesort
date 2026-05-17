-- add-habits.sql
--
-- Idempotent migration for the Habits & Routines feature.
-- Safe to run multiple times — every statement uses IF NOT EXISTS guards.

BEGIN;

-- ── Habits ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS habits (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  frequency VARCHAR(50) NOT NULL DEFAULT 'daily',  -- daily | weekly | custom
  custom_days INTEGER[] DEFAULT '{}',               -- 0=Sun … 6=Sat for 'custom'
  target_count INTEGER NOT NULL DEFAULT 1,          -- completions per period
  reminder_time TIME,                               -- optional daily reminder
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  color VARCHAR(20) NOT NULL DEFAULT '#2563EB',
  icon VARCHAR(50) NOT NULL DEFAULT 'CheckSquare',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_habits_life_area_id ON habits(life_area_id);

-- ── Habit Check-ins ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS habit_checkins (
  id SERIAL PRIMARY KEY,
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,                 -- how many completions that day
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(habit_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_checkins_habit_date ON habit_checkins(habit_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_habit_checkins_user_date ON habit_checkins(user_id, checkin_date);

-- ── Routines ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS routines (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  routine_type VARCHAR(50) NOT NULL DEFAULT 'custom', -- morning | evening | custom
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_user_active ON routines(user_id, is_active);

-- ── Routine Steps ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS routine_steps (
  id SERIAL PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  step_type VARCHAR(50) NOT NULL DEFAULT 'habit',  -- habit | task | custom
  habit_id INTEGER REFERENCES habits(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_steps_routine_id ON routine_steps(routine_id, sort_order);

COMMIT;
