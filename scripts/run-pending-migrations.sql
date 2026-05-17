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

-- ── Personal Operating Rules ────────────────────────────────────────────────

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

-- ── Universal Life Inbox ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbox_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  raw_text TEXT NOT NULL DEFAULT '',
  suggested_type VARCHAR(50) CHECK (
    suggested_type IS NULL OR suggested_type IN (
      'task',
      'goal',
      'note',
      'project',
      'habit',
      'wishlist_item',
      'vault_item',
      'calendar_event'
    )
  ),
  status VARCHAR(30) NOT NULL DEFAULT 'unsorted' CHECK (status IN ('unsorted', 'converted', 'archived')),
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'quick_add', 'ai_capture')),
  converted_type VARCHAR(50) CHECK (
    converted_type IS NULL OR converted_type IN (
      'task',
      'goal',
      'note',
      'project',
      'habit',
      'wishlist_item',
      'vault_item',
      'calendar_event'
    )
  ),
  converted_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_status_updated
  ON inbox_items(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_items_life_area_id
  ON inbox_items(life_area_id);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_converted
  ON inbox_items(user_id, converted_type, converted_id);

-- ── Someday / Maybe ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS someday_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'idea' CHECK (
    category IN ('idea', 'project', 'purchase', 'travel', 'learning', 'relationship', 'finance', 'health', 'other')
  ),
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  review_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'someday' CHECK (status IN ('someday', 'promoted', 'archived')),
  promoted_type VARCHAR(50) CHECK (
    promoted_type IS NULL OR promoted_type IN ('project', 'goal', 'task', 'wishlist_item', 'note')
  ),
  promoted_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_id
  ON someday_items(user_id);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_status
  ON someday_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_review_date
  ON someday_items(user_id, review_date);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_category
  ON someday_items(user_id, category);

CREATE INDEX IF NOT EXISTS idx_someday_items_life_area_id
  ON someday_items(life_area_id);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_promoted
  ON someday_items(user_id, promoted_type, promoted_id);

-- ── Waiting For Tracker ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS waiting_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  waiting_on_name VARCHAR(255) NOT NULL,
  waiting_on_type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (
    waiting_on_type IN (
      'person',
      'company',
      'school',
      'bank',
      'government',
      'delivery',
      'refund',
      'job',
      'other'
    )
  ),
  status VARCHAR(50) NOT NULL DEFAULT 'waiting' CHECK (
    status IN ('waiting', 'follow_up_needed', 'resolved', 'cancelled')
  ),
  expected_date DATE,
  follow_up_date DATE,
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  project_id INTEGER,
  person_id INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'waiting_items_project_id_fkey'
     ) THEN
    ALTER TABLE waiting_items
      ADD CONSTRAINT waiting_items_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.people') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'waiting_items_person_id_fkey'
     ) THEN
    ALTER TABLE waiting_items
      ADD CONSTRAINT waiting_items_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_waiting_items_user_id
  ON waiting_items(user_id);

CREATE INDEX IF NOT EXISTS idx_waiting_items_user_status
  ON waiting_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_waiting_items_user_follow_up_date
  ON waiting_items(user_id, follow_up_date);

CREATE INDEX IF NOT EXISTS idx_waiting_items_user_expected_date
  ON waiting_items(user_id, expected_date);

CREATE INDEX IF NOT EXISTS idx_waiting_items_life_area_id
  ON waiting_items(life_area_id);

CREATE INDEX IF NOT EXISTS idx_waiting_items_project_id
  ON waiting_items(project_id);

CREATE INDEX IF NOT EXISTS idx_waiting_items_person_id
  ON waiting_items(person_id);

-- ── Commitments Tracker ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS commitments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  committed_to VARCHAR(255) NOT NULL,
  commitment_type VARCHAR(50) NOT NULL DEFAULT 'personal' CHECK (
    commitment_type IN ('personal', 'work', 'school', 'family', 'friend', 'client', 'financial', 'other')
  ),
  due_date DATE,
  status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'at_risk', 'completed', 'missed', 'cancelled')
  ),
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  project_id INTEGER,
  person_id INTEGER,
  related_task_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commitments_user_id
  ON commitments(user_id);

CREATE INDEX IF NOT EXISTS idx_commitments_user_status
  ON commitments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_commitments_user_due_date
  ON commitments(user_id, due_date);

CREATE INDEX IF NOT EXISTS idx_commitments_life_area_id
  ON commitments(life_area_id);

CREATE INDEX IF NOT EXISTS idx_commitments_project_id
  ON commitments(project_id);

CREATE INDEX IF NOT EXISTS idx_commitments_person_id
  ON commitments(person_id);

CREATE INDEX IF NOT EXISTS idx_commitments_related_task_id
  ON commitments(related_task_id);

-- ── Life Maintenance Tracker ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS maintenance_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (
    category IN ('home', 'vehicle', 'health', 'finance', 'digital', 'school', 'work', 'business', 'other')
  ),
  recurrence VARCHAR(50) NOT NULL DEFAULT 'monthly' CHECK (
    recurrence IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')
  ),
  custom_interval_days INTEGER CHECK (
    custom_interval_days IS NULL OR (custom_interval_days >= 1 AND custom_interval_days <= 3650)
  ),
  next_due_date DATE,
  last_completed_date DATE,
  reminder_days_before INTEGER NOT NULL DEFAULT 7 CHECK (
    reminder_days_before >= 0 AND reminder_days_before <= 365
  ),
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  vault_item_id INTEGER,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'paused', 'completed')
  ),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regclass('public.vault_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_items_vault_item_id_fkey'
     ) THEN
    ALTER TABLE maintenance_items
      ADD CONSTRAINT maintenance_items_vault_item_id_fkey
      FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_id
  ON maintenance_items(user_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_status
  ON maintenance_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_next_due_date
  ON maintenance_items(user_id, next_due_date);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_category
  ON maintenance_items(user_id, category);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_life_area_id
  ON maintenance_items(life_area_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_vault_item_id
  ON maintenance_items(vault_item_id);

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

DO $$
BEGIN
  IF to_regclass('public.projects') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'waiting_items_project_id_fkey'
     ) THEN
    ALTER TABLE waiting_items
      ADD CONSTRAINT waiting_items_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.people') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'waiting_items_person_id_fkey'
     ) THEN
    ALTER TABLE waiting_items
      ADD CONSTRAINT waiting_items_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.projects') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'commitments_project_id_fkey'
     ) THEN
    ALTER TABLE commitments
      ADD CONSTRAINT commitments_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.people') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'commitments_person_id_fkey'
     ) THEN
    ALTER TABLE commitments
      ADD CONSTRAINT commitments_person_id_fkey
      FOREIGN KEY (person_id) REFERENCES people(id) ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.tasks') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'commitments_related_task_id_fkey'
     ) THEN
    ALTER TABLE commitments
      ADD CONSTRAINT commitments_related_task_id_fkey
      FOREIGN KEY (related_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

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

-- ── AI usage events ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  model VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'accepted',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_route_created
  ON ai_usage_events(user_id, route, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_route_created
  ON ai_usage_events(route, created_at DESC);

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
