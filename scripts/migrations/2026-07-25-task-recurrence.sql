-- Task recurrence -- AI_BUILD_PLAN.md Phase 1 "Tasks depth", sub-step 3.
-- Additive, forward-only. Mirror into scripts/schema.sql after applying.
-- One row per recurring task (task_id is UNIQUE): the task itself is the
-- recurring instance, not a template -- completing it advances its own
-- due/scheduled date rather than spawning a new task row. See AI_DECISIONS.md.
-- Task dependencies deliberately do NOT get a new table here -- the existing
-- item_relationships table already has a 'depends_on' relation type (A6),
-- so task-to-task dependencies are stored there instead.

CREATE TABLE IF NOT EXISTS task_recurrence (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN (
    'daily', 'weekdays', 'weekly', 'monthly', 'yearly', 'custom'
  )),
  interval_count INTEGER NOT NULL DEFAULT 1,
  repeat_after_completion BOOLEAN NOT NULL DEFAULT FALSE,
  ends_on DATE,
  ends_after_count INTEGER,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_recurrence_task ON task_recurrence(user_id, task_id);
