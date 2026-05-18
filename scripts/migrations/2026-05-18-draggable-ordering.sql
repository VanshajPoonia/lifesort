ALTER TABLE daily_plans
  ADD COLUMN IF NOT EXISTS today_item_order JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY completed ASC, due_date ASC NULLS LAST, created_at DESC, id DESC
    ) - 1 AS next_sort_order
  FROM tasks
)
UPDATE tasks
SET sort_order = ranked.next_sort_order
FROM ranked
WHERE tasks.id = ranked.id
  AND tasks.sort_order IS NULL;

UPDATE tasks
SET sort_order = 0
WHERE sort_order IS NULL;

ALTER TABLE tasks
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_user_sort_order
  ON tasks(user_id, sort_order, id);
