-- Tasks depth, sub-step 2 -- AI_BUILD_PLAN.md Phase 1 "Tasks depth" (spec §9):
-- due date vs scheduled date vs duration, plus the full status set.
-- Additive, forward-only. Mirror into scripts/schema.sql after applying.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_time TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'next' CHECK (status IN (
  'inbox', 'next', 'in_progress', 'waiting', 'someday', 'completed', 'cancelled'
));

-- Backfill: existing completed tasks should read as status = 'completed', not
-- the 'next' default. `completed` stays a synced/derived convenience column
-- going forward (see AI_DECISIONS.md) -- this is a one-time correction so
-- historical rows aren't misclassified after the column is added.
UPDATE tasks SET status = 'completed' WHERE completed = TRUE AND status = 'next';
