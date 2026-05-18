-- 2026-05-18-missing-user-id-indexes.sql
--
-- Adds (user_id) indexes to three tables that were lacking them. Queries
-- scoping by user_id will use these instead of full-scanning the table.
--
-- NOTE: CREATE INDEX CONCURRENTLY cannot run inside a transaction block,
-- so this file intentionally has no BEGIN/COMMIT. Run statement-by-statement
-- (e.g., through the Neon SQL Editor or psql -f), not through a driver that
-- wraps statements in an implicit transaction (the Neon serverless driver does).
--
-- Idempotent — safe to run multiple times.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_user_id
  ON password_reset_tokens(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nuke_goals_user_id
  ON nuke_goals(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budget_goals_user_id
  ON budget_goals(user_id);
