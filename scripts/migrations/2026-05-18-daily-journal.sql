CREATE TABLE IF NOT EXISTS daily_journal_entries (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journal_date DATE NOT NULL,
  mood INTEGER CHECK (mood IS NULL OR (mood >= 1 AND mood <= 5)),
  gratitude JSONB NOT NULL DEFAULT '[]'::jsonb,
  affirmation_text TEXT,
  affirmation_pinned_until TIMESTAMP,
  work_todo JSONB NOT NULL DEFAULT '[]'::jsonb,
  personal_todo JSONB NOT NULL DEFAULT '[]'::jsonb,
  family_todo JSONB NOT NULL DEFAULT '[]'::jsonb,
  what_went_well TEXT,
  what_could_be_better TEXT,
  notes_from_today TEXT,
  how_to_make_tomorrow_better TEXT,
  work_stars INTEGER CHECK (work_stars IS NULL OR (work_stars >= 1 AND work_stars <= 5)),
  work_stars_note TEXT,
  personal_stars INTEGER CHECK (personal_stars IS NULL OR (personal_stars >= 1 AND personal_stars <= 5)),
  personal_stars_note TEXT,
  family_stars INTEGER CHECK (family_stars IS NULL OR (family_stars >= 1 AND family_stars <= 5)),
  family_stars_note TEXT,
  tomorrow_focus TEXT,
  tomorrow_avoid TEXT,
  energy_level TEXT CHECK (energy_level IS NULL OR energy_level IN ('low', 'medium', 'high')),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  locked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, journal_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_journal_entries_user_date
  ON daily_journal_entries(user_id, journal_date DESC);
