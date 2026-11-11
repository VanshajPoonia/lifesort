-- Drop Spaces and Custom Sections, removed in Stage 1 step 5 (AI_BUILD_PLAN.md Part 0,
-- "Retiring empty tables"). Approved by the user on 2026-11-11.
--
-- Life domains are the one way to group things, and a note with a simple list covers
-- what Custom Sections did. No code reads or writes these tables any more, and
-- templates no longer create them.
--
-- RUN ORDER MATTERS. Every Vercel environment shares one database. Only run this
-- after the code that removed the readers is deployed to production.
--
-- The guard stops the drop if any table has gained a row since the 2026-11-11
-- read-only count (all five had 0 rows).

BEGIN;

DO $$
DECLARE
  total bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM spaces)
    + (SELECT count(*) FROM space_items)
    + (SELECT count(*) FROM custom_sections)
    + (SELECT count(*) FROM custom_section_items)
    + (SELECT count(*) FROM custom_section_records)
  INTO total;
  IF total > 0 THEN
    RAISE EXCEPTION 'Refusing to drop: Spaces and Custom Sections hold % row(s).', total;
  END IF;
END $$;

-- Children first, so no CASCADE is needed.
DROP TABLE IF EXISTS space_items;
DROP TABLE IF EXISTS spaces;
DROP TABLE IF EXISTS custom_section_records;
DROP TABLE IF EXISTS custom_section_items;
DROP TABLE IF EXISTS custom_sections;

COMMIT;
