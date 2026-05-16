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

CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned);

-- ── Tasks ────────────────────────────────────────────────────────────────────

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- ── Goals ────────────────────────────────────────────────────────────────────

ALTER TABLE goals ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);

-- ── Calendar events ──────────────────────────────────────────────────────────

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS event_date DATE;
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, event_date);

-- ── Nuke goals ───────────────────────────────────────────────────────────────

ALTER TABLE nuke_goals ADD COLUMN IF NOT EXISTS deadline DATE;

-- ── Custom sections (description + fields + records) ─────────────────────────

ALTER TABLE custom_sections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE custom_sections ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS custom_section_records (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES custom_sections(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_section_records_section_id ON custom_section_records(section_id);

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
