-- Browser push subscriptions, one row per device (AI_BUILD_PLAN.md Part 0, Stage 2).
-- Approved by the user on 2026-11-16.
--
-- Additive only, so it is safe to run before the code that uses it is deployed.
-- endpoint is unique: if someone else signs in on the same browser, the row moves to them.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT         NOT NULL UNIQUE,
  p256dh          TEXT         NOT NULL,
  auth            TEXT         NOT NULL,
  user_agent      TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_success_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
