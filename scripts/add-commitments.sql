-- Add Commitments tracker
-- Safe/idempotent migration. Review target database before running.

BEGIN;

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

DO $$
BEGIN
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

COMMIT;
