-- Drop the four tables folded into Tasks in Stage 1 step 3 (AI_BUILD_PLAN.md Part 0,
-- "Retiring empty tables"). Approved by the user on 2026-11-11.
--
-- Waiting For, Someday / Maybe, Commitments and Maintenance are now task statuses,
-- notes and recurrence rules. No code reads or writes these tables any more.
--
-- RUN ORDER MATTERS. Every Vercel environment shares one database. Only run this
-- after the branch that removed the readers is merged and deployed to production.
-- Older deployments still query these tables and would error.
--
-- The guard below stops the drop if any table has gained a row since the
-- 2026-11-11 read-only count (all four had 0 rows).

BEGIN;

DO $$
DECLARE
  total bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM waiting_items)
    + (SELECT count(*) FROM someday_items)
    + (SELECT count(*) FROM commitments)
    + (SELECT count(*) FROM maintenance_items)
  INTO total;
  IF total > 0 THEN
    RAISE EXCEPTION 'Refusing to drop: the folded tables hold % row(s). Move them into tasks first.', total;
  END IF;
END $$;

DROP TABLE IF EXISTS waiting_items;
DROP TABLE IF EXISTS someday_items;
DROP TABLE IF EXISTS commitments;
DROP TABLE IF EXISTS maintenance_items;

COMMIT;
