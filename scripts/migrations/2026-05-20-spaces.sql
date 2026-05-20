-- LifeSort Spaces / Pages system
-- Forward-only additive migration. Do not run automatically.

CREATE TABLE IF NOT EXISTS spaces (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50) NOT NULL DEFAULT 'primary',
  icon VARCHAR(80) NOT NULL DEFAULT 'FolderKanban',
  favorite BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS space_items (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  space_id VARCHAR(255) NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('note', 'whiteboard', 'task', 'project', 'link', 'custom_section')),
  item_id VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(space_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_spaces_user_id ON spaces(user_id);
CREATE INDEX IF NOT EXISTS idx_spaces_user_archived ON spaces(user_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_spaces_user_favorite ON spaces(user_id, favorite);
CREATE INDEX IF NOT EXISTS idx_space_items_space_id ON space_items(space_id);
CREATE INDEX IF NOT EXISTS idx_space_items_lookup ON space_items(item_type, item_id);
