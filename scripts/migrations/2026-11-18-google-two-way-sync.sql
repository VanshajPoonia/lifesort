-- Two-way Google Calendar sync (AI_BUILD_PLAN.md Part 0, Stage 6). Approved by the
-- user on 2026-11-18.
--
-- Additive only, so it is safe to run before the code that uses it is deployed.
-- scope: the Google permissions granted at connect. time_zone: the person's zone,
-- saved when they turn sync on. sync_to_google: off until they turn it on.
-- calendar_sync_links pairs a LifeSort event or task with its Google copy.

ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS scope TEXT;
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS time_zone VARCHAR(64);
ALTER TABLE calendar_integrations ADD COLUMN IF NOT EXISTS sync_to_google BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS calendar_sync_links (
  id                SERIAL PRIMARY KEY,
  user_id           VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type         VARCHAR(20)  NOT NULL CHECK (item_type IN ('event', 'task')),
  item_id           INTEGER      NOT NULL,
  google_event_id   VARCHAR(255) NOT NULL,
  google_updated_at TIMESTAMP WITH TIME ZONE,
  pushed_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_type, item_id),
  UNIQUE (user_id, google_event_id)
);
