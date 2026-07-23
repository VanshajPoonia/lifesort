-- Life Domains Phase 2 (see AI_LIFE_DOMAINS_SPEC.md section 3.2, 3.4, and 19).
-- Journal/Calendar domain association + per-domain reviews.
-- Do not run automatically; apply to the intended LifeSort database after target confirmation.

ALTER TABLE daily_journal_entries
  ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_journal_entries_life_area ON daily_journal_entries(user_id, life_area_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_life_area ON calendar_events(user_id, life_area_id);

CREATE TABLE IF NOT EXISTS life_area_reviews (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  life_area_id INTEGER NOT NULL REFERENCES life_areas(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL DEFAULT 'custom' CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'custom')),
  period_start DATE,
  period_end DATE,
  feeling TEXT,
  improved TEXT,
  needs_attention TEXT,
  stress TEXT,
  stop_doing TEXT,
  continue_doing TEXT,
  next_action TEXT,
  attention_adjustment TEXT CHECK (attention_adjustment IN ('increase', 'decrease', 'keep_same') OR attention_adjustment IS NULL),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_area_reviews_user_area ON life_area_reviews(user_id, life_area_id, created_at DESC);
