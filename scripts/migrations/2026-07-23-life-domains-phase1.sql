-- Life Domains Phase 1 (see AI_LIFE_DOMAINS_SPEC.md section 3.1 and 19).
-- Additive lifecycle/attention columns on the existing life_areas table.
-- Do not run automatically; apply to the intended LifeSort database after target confirmation.

ALTER TABLE life_areas
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'archived', 'hidden')),
  ADD COLUMN IF NOT EXISTS importance TEXT
    CHECK (importance IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS desired_attention TEXT
    CHECK (desired_attention IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS review_frequency TEXT NOT NULL DEFAULT 'none'
    CHECK (review_frequency IN ('weekly', 'monthly', 'quarterly', 'custom', 'none')),
  ADD COLUMN IF NOT EXISTS health_status TEXT NOT NULL DEFAULT 'not_assessed'
    CHECK (health_status IN ('thriving', 'stable', 'needs_attention', 'paused', 'not_assessed')),
  ADD COLUMN IF NOT EXISTS parent_domain_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS definition_of_success TEXT,
  ADD COLUMN IF NOT EXISTS current_concerns TEXT,
  ADD COLUMN IF NOT EXISTS long_term_vision TEXT,
  ADD COLUMN IF NOT EXISTS current_focus TEXT,
  ADD COLUMN IF NOT EXISTS boundaries TEXT,
  ADD COLUMN IF NOT EXISTS is_ai_excluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_reauth BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_life_areas_user_status ON life_areas(user_id, status);
CREATE INDEX IF NOT EXISTS idx_life_areas_parent ON life_areas(parent_domain_id);
