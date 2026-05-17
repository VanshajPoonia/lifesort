-- run-pending-migrations.sql
--
-- Idempotent consolidated migration to bring the live database up to date
-- with what the application code expects. Safe to run multiple times — every
-- statement uses IF NOT EXISTS / IF EXISTS guards.
--
-- Run this once against the Neon production database, then verify the
-- regression checkpoint passes for /api/notes, /api/tasks, /api/goals,
-- /api/custom-sections, /api/calendar-events, /api/note-folders.

BEGIN;

-- ── Life Areas ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS life_areas (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(50) NOT NULL DEFAULT 'Target',
  color VARCHAR(20) NOT NULL DEFAULT '#2563EB',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_life_areas_user_order ON life_areas(user_id, sort_order, name);

INSERT INTO life_areas (user_id, name, icon, color, description, sort_order)
SELECT users.id, seed.name, seed.icon, seed.color, seed.description, seed.sort_order
FROM users
CROSS JOIN (
  VALUES
    ('Work', 'Briefcase', '#2563EB', 'Career, job responsibilities, and professional projects', 0),
    ('School', 'GraduationCap', '#7C3AED', 'Classes, coursework, exams, and academic planning', 1),
    ('Finance', 'Wallet', '#059669', 'Money, budgets, income, investing, and financial goals', 2),
    ('Health', 'HeartPulse', '#DC2626', 'Medical care, wellness, appointments, and health habits', 3),
    ('Fitness', 'Dumbbell', '#EA580C', 'Training, movement, strength, and physical goals', 4),
    ('Family', 'Home', '#DB2777', 'Family responsibilities, plans, and relationships', 5),
    ('Friends', 'Users', '#0891B2', 'Friendships, social plans, and community', 6),
    ('Personal', 'User', '#4F46E5', 'Personal admin, routines, and self-management', 7),
    ('Learning', 'BookOpen', '#9333EA', 'Skills, reading, courses, and curiosity', 8),
    ('Business', 'Building2', '#0F766E', 'Business ideas, operations, clients, and growth', 9),
    ('Home', 'House', '#CA8A04', 'Home projects, maintenance, chores, and space planning', 10),
    ('Travel', 'Plane', '#0284C7', 'Trips, itineraries, packing, and places to go', 11),
    ('Creativity', 'Palette', '#C026D3', 'Creative projects, art, writing, and making things', 12)
) AS seed(name, icon, color, description, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;

-- ── Today Plan ───────────────────────────────────────────────────────────────

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

-- ── Weekly Reviews ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  reflection_wins TEXT,
  reflection_challenges TEXT,
  reflection_lessons TEXT,
  reflection_next_week_focus TEXT,
  summary_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_week ON weekly_reviews(user_id, week_start DESC);

-- ── Life Projects ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  priority VARCHAR(30) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  start_date DATE,
  due_date DATE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_items (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN (
    'task',
    'goal',
    'note',
    'link',
    'wishlist',
    'budget_category',
    'budget_transaction',
    'budget_goal'
  )),
  item_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS project_activity (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  item_type VARCHAR(50),
  item_id INTEGER,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_projects_life_area_id ON projects(life_area_id);
CREATE INDEX IF NOT EXISTS idx_project_items_project_id ON project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_items_user_type_item ON project_items(user_id, item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_project_created ON project_activity(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_user_created ON project_activity(user_id, created_at DESC);

-- ── Notes knowledge area ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS note_folders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_folders_user_id ON note_folders(user_id);

ALTER TABLE notes ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES note_folders(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned);
CREATE INDEX IF NOT EXISTS idx_notes_life_area_id ON notes(life_area_id);

-- ── Tasks ────────────────────────────────────────────────────────────────────

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_life_area_id ON tasks(life_area_id);

-- ── Goals ────────────────────────────────────────────────────────────────────

ALTER TABLE goals ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_goals_life_area_id ON goals(life_area_id);

-- ── Calendar events ──────────────────────────────────────────────────────────

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_date DATE;
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, event_date);

-- ── Nuke goals ───────────────────────────────────────────────────────────────

ALTER TABLE nuke_goals ADD COLUMN IF NOT EXISTS deadline DATE;

-- ── Custom sections (description + fields + records) ─────────────────────────

ALTER TABLE custom_sections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE custom_sections ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '[]';
ALTER TABLE custom_sections ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS custom_section_records (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES custom_sections(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_section_records_section_id ON custom_section_records(section_id);
CREATE INDEX IF NOT EXISTS idx_custom_sections_life_area_id ON custom_sections(life_area_id);

-- ── Life Area links on existing feature tables ───────────────────────────────

ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wishlist_life_area_id ON wishlist_items(life_area_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_life_area_id ON budget_categories(life_area_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_life_area_id ON income_sources(life_area_id);
CREATE INDEX IF NOT EXISTS idx_investments_life_area_id ON investments(life_area_id);

COMMIT;

-- Verify with:
--   \d notes      -- should show folder_id, tags, is_pinned
--   \d tasks      -- should show due_time, priority
--   \d goals      -- should show priority
--   \d calendar_events  -- should show event_date
--   \d nuke_goals -- should show deadline
--   \d custom_sections  -- should show description, fields
--   SELECT * FROM note_folders LIMIT 0;
--   SELECT * FROM custom_section_records LIMIT 0;
