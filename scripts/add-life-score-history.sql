-- Add explainable LifeScore daily snapshots.
-- Safe to run more than once. Review target database before applying.

CREATE TABLE IF NOT EXISTS life_score_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score_date DATE NOT NULL DEFAULT CURRENT_DATE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  label VARCHAR(100) NOT NULL,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  unavailable TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_life_score_history_user_date
  ON life_score_history(user_id, score_date DESC);
