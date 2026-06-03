-- Persist user-created, forked, and AI-generated Templates.
-- Do not run automatically; apply to the intended LifeSort database after target confirmation.

CREATE TABLE IF NOT EXISTS user_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai', 'forked')),
  forked_from TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_templates_user_updated
  ON user_templates(user_id, (COALESCE(last_used_at, updated_at, created_at)) DESC);

CREATE INDEX IF NOT EXISTS idx_user_templates_user_source
  ON user_templates(user_id, source);
