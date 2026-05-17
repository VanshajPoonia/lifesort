-- Add Someday / Maybe items for low-pressure future ideas.
-- Safe to run multiple times. Do not run without confirming the target database.

CREATE TABLE IF NOT EXISTS someday_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'idea' CHECK (
    category IN ('idea', 'project', 'purchase', 'travel', 'learning', 'relationship', 'finance', 'health', 'other')
  ),
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  review_date DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'someday' CHECK (status IN ('someday', 'promoted', 'archived')),
  promoted_type VARCHAR(50) CHECK (
    promoted_type IS NULL OR promoted_type IN ('project', 'goal', 'task', 'wishlist_item', 'note')
  ),
  promoted_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_id
  ON someday_items(user_id);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_status
  ON someday_items(user_id, status);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_review_date
  ON someday_items(user_id, review_date);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_category
  ON someday_items(user_id, category);

CREATE INDEX IF NOT EXISTS idx_someday_items_life_area_id
  ON someday_items(life_area_id);

CREATE INDEX IF NOT EXISTS idx_someday_items_user_promoted
  ON someday_items(user_id, promoted_type, promoted_id);
