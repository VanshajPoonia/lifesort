-- Drop the Focus Goal and Pomodoro tables (AI_BUILD_PLAN.md Part 0, Stage 1 leftovers).
-- Approved by the user on 2026-11-16.
--
-- Focus Goal (/nuke) was retired and redirects to Goals. Pomodoro (/pomodoro)
-- redirects to Today's focus timer. pomodoro_sessions and pomodoro_settings never
-- had a reader. No code reads or writes any of the three tables any more.
--
-- RUN ORDER MATTERS. Every Vercel environment shares one database. Only run this
-- after the branch that removed the readers is merged and deployed to production.
-- Older deployments still query nuke_goals and would error.
--
-- The guard below stops the drop if any table has gained a row since the
-- 2026-11-16 read-only count (all three had 0 rows).

BEGIN;

DO $$
DECLARE
  total bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM nuke_goals)
    + (SELECT count(*) FROM pomodoro_sessions)
    + (SELECT count(*) FROM pomodoro_settings)
  INTO total;
  IF total > 0 THEN
    RAISE EXCEPTION 'Refusing to drop: the Focus Goal and Pomodoro tables hold % row(s).', total;
  END IF;
END $$;

DROP TABLE IF EXISTS nuke_goals;
DROP TABLE IF EXISTS pomodoro_sessions;
DROP TABLE IF EXISTS pomodoro_settings;

COMMIT;
