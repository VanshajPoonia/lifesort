-- User-scoped AI usage audit and conservative daily limits.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  route VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  model VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'accepted',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_route_created
  ON ai_usage_events(user_id, route, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_route_created
  ON ai_usage_events(route, created_at DESC);
