-- In-App Notification Center
-- Creates the notifications table for storing user-scoped in-app alerts.
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS guards).

CREATE TABLE IF NOT EXISTS notifications (
  id                SERIAL PRIMARY KEY,
  user_id           VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              VARCHAR(50)  NOT NULL,
  related_item_type VARCHAR(50)  NOT NULL DEFAULT '',
  related_item_id   TEXT         NOT NULL DEFAULT '',
  title             VARCHAR(255) NOT NULL,
  message           TEXT         NOT NULL DEFAULT '',
  is_read           BOOLEAN      NOT NULL DEFAULT FALSE,
  read_at           TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, type, related_item_type, related_item_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);
