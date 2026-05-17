-- Add Life Maintenance tracker
-- Safe/idempotent migration. Review target database before running.

BEGIN;

CREATE TABLE IF NOT EXISTS maintenance_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (
    category IN ('home', 'vehicle', 'health', 'finance', 'digital', 'school', 'work', 'business', 'other')
  ),
  recurrence VARCHAR(50) NOT NULL DEFAULT 'monthly' CHECK (
    recurrence IN ('weekly', 'monthly', 'quarterly', 'yearly', 'custom')
  ),
  custom_interval_days INTEGER CHECK (
    custom_interval_days IS NULL OR (custom_interval_days >= 1 AND custom_interval_days <= 3650)
  ),
  next_due_date DATE,
  last_completed_date DATE,
  reminder_days_before INTEGER NOT NULL DEFAULT 7 CHECK (
    reminder_days_before >= 0 AND reminder_days_before <= 365
  ),
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  vault_item_id INTEGER,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'paused', 'completed')
  ),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regclass('public.vault_items') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_items_vault_item_id_fkey'
     ) THEN
    ALTER TABLE maintenance_items
      ADD CONSTRAINT maintenance_items_vault_item_id_fkey
      FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_id
  ON maintenance_items(user_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_status
  ON maintenance_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_next_due_date
  ON maintenance_items(user_id, next_due_date);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_category
  ON maintenance_items(user_id, category);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_life_area_id
  ON maintenance_items(life_area_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_vault_item_id
  ON maintenance_items(vault_item_id);

COMMIT;
