-- Generic attachments system (Core Organization, AI_PROJECT.md / AI_DECISIONS.md).
-- Files themselves live in Cloudflare R2 (private bucket, presigned URLs); this table only
-- stores per-file metadata plus the R2 object key. Additive only.
-- Do not run automatically; apply to the intended LifeSort database after target confirmation.

CREATE TABLE IF NOT EXISTS attachments (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('task', 'goal', 'project', 'note', 'vault_item')),
  item_id INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments(user_id, item_type, item_id);
