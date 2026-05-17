-- 2026-05-18-add-indexes.sql
--
-- Three additive indexes to back the most common filter/sort patterns on
-- habits, notifications, and routine_steps. CONCURRENTLY avoids table locks
-- on a live database; each statement runs in its own transaction.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block,
-- so this file intentionally has no BEGIN/COMMIT. Run statement-by-statement
-- (e.g., through the Neon SQL Editor or psql -f), not through a driver that
-- wraps statements in an implicit transaction (the Neon serverless driver does).
--
-- Idempotent — safe to run multiple times.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_habits_user_frequency
  ON habits(user_id, frequency);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_type
  ON notifications(user_id, type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_routine_steps_routine_sort
  ON routine_steps(routine_id, sort_order);
