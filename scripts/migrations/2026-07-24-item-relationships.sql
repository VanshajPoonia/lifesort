-- Generic item_relationships table (AI_BUILD_PLAN.md Phase 0 / A6).
-- The general backlink/mention/related/dependency graph across LifeSort object types.
-- Existing typed links (project_items, space_items, life_area_id, goal_id,
-- converted_type/id, promoted_type/id) stay authoritative for their own domains --
-- this table never duplicates or overrides them. Additive only.
-- Do not run automatically; apply to the intended LifeSort database after target confirmation.

-- item_id/from_id/to_id are VARCHAR(255) (not INTEGER) because linked item types span
-- both SERIAL-integer tables (tasks, goals, projects, notes, ...) and VARCHAR/UUID
-- tables (whiteboards, spaces) -- same reasoning as space_items.item_id.
CREATE TABLE IF NOT EXISTS item_relationships (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_type VARCHAR(50) NOT NULL CHECK (from_type IN (
    'task', 'goal', 'project', 'note', 'life_area', 'journal_entry', 'whiteboard',
    'space', 'person', 'vault_item', 'wishlist_item', 'someday_item', 'inbox_item',
    'waiting_item', 'commitment', 'maintenance_item', 'custom_section'
  )),
  from_id VARCHAR(255) NOT NULL,
  to_type VARCHAR(50) NOT NULL CHECK (to_type IN (
    'task', 'goal', 'project', 'note', 'life_area', 'journal_entry', 'whiteboard',
    'space', 'person', 'vault_item', 'wishlist_item', 'someday_item', 'inbox_item',
    'waiting_item', 'commitment', 'maintenance_item', 'custom_section'
  )),
  to_id VARCHAR(255) NOT NULL,
  relation VARCHAR(30) NOT NULL CHECK (relation IN (
    'backlink', 'mention', 'related', 'depends_on', 'source_of', 'converted_from'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, from_type, from_id, to_type, to_id, relation)
);

CREATE INDEX IF NOT EXISTS idx_item_relationships_from ON item_relationships(user_id, from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_item_relationships_to ON item_relationships(user_id, to_type, to_id);
