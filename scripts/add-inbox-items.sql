-- add-inbox-items.sql
--
-- Idempotent migration for the Universal Life Inbox feature.
-- Safe to run multiple times; review the target database before running.

BEGIN;

CREATE TABLE IF NOT EXISTS inbox_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  raw_text TEXT NOT NULL DEFAULT '',
  suggested_type VARCHAR(50) CHECK (
    suggested_type IS NULL OR suggested_type IN (
      'task',
      'goal',
      'note',
      'project',
      'habit',
      'wishlist_item',
      'vault_item',
      'calendar_event'
    )
  ),
  status VARCHAR(30) NOT NULL DEFAULT 'unsorted' CHECK (status IN ('unsorted', 'converted', 'archived')),
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  source VARCHAR(30) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'quick_add', 'ai_capture')),
  converted_type VARCHAR(50) CHECK (
    converted_type IS NULL OR converted_type IN (
      'task',
      'goal',
      'note',
      'project',
      'habit',
      'wishlist_item',
      'vault_item',
      'calendar_event'
    )
  ),
  converted_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_status_updated
  ON inbox_items(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_items_life_area_id
  ON inbox_items(life_area_id);

CREATE INDEX IF NOT EXISTS idx_inbox_items_user_converted
  ON inbox_items(user_id, converted_type, converted_id);

COMMIT;
