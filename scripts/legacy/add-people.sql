-- add-people.sql
--
-- Idempotent migration for the People / Relationships feature.
-- Safe to run multiple times — every statement uses IF NOT EXISTS guards.

BEGIN;

-- ── People ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  relationship_type VARCHAR(50) NOT NULL DEFAULT 'other', -- family|friend|work|school|client|mentor|other
  email VARCHAR(255),
  phone VARCHAR(50),
  birthday DATE,
  location VARCHAR(255),
  notes TEXT,
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  avatar_color VARCHAR(20) NOT NULL DEFAULT '#2563EB',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
CREATE INDEX IF NOT EXISTS idx_people_user_type ON people(user_id, relationship_type);
CREATE INDEX IF NOT EXISTS idx_people_life_area_id ON people(life_area_id);
CREATE INDEX IF NOT EXISTS idx_people_birthday ON people(user_id, birthday) WHERE birthday IS NOT NULL;

-- ── People Reminders ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS people_reminders (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type VARCHAR(50) NOT NULL DEFAULT 'custom', -- birthday|follow_up|custom
  title VARCHAR(255) NOT NULL,
  remind_at TIMESTAMP NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recur_interval VARCHAR(50),                          -- yearly|monthly|weekly
  is_sent BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_reminders_person_id ON people_reminders(person_id);
CREATE INDEX IF NOT EXISTS idx_people_reminders_user_due ON people_reminders(user_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_people_reminders_unsent ON people_reminders(user_id, remind_at) WHERE is_sent = FALSE;

-- ── People Links ─────────────────────────────────────────────────────────────
-- Polymorphic links to tasks, notes, projects, and calendar events.

CREATE TABLE IF NOT EXISTS people_links (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL,   -- task|note|project|calendar_event
  item_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(person_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_people_links_person_id ON people_links(person_id);
CREATE INDEX IF NOT EXISTS idx_people_links_user_id ON people_links(user_id);

COMMIT;
