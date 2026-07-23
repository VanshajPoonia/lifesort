-- Generic tags system (AGENTS.md/AI_PROJECT.md Core Organization polish).
-- Additive only -- does not touch or replace the existing TEXT[] tags columns on
-- notes/people/vault_items/budget_transactions. Used for object types that have no
-- tagging today (tasks, goals, projects); see AI_DECISIONS.md for the reasoning.
-- Do not run automatically; apply to the intended LifeSort database after target confirmation.

CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#64748B',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS item_tags (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('task', 'goal', 'project')),
  item_id INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tag_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(user_id, item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id);
