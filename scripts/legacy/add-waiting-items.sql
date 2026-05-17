-- Add Waiting For tracker
-- Safe/idempotent migration. Review target database before running.

BEGIN;

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

COMMIT;
