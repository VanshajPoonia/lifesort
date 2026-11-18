-- Email and WhatsApp capture (AI_BUILD_PLAN.md Part 0, part D). Approved by the user
-- on 2026-11-18 as part of building the four parked features.
--
-- Additive only, so it is safe to run before the code that uses it is deployed.
-- One row per person and channel: the private email address token, or the linked
-- WhatsApp number (and the short code that links it until then).
-- The inbox_items.source change repeats 2026-11-18-connector-oauth.sql so either file
-- can run first.

CREATE TABLE IF NOT EXISTS capture_channels (
  id                   SERIAL PRIMARY KEY,
  user_id              VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel              VARCHAR(20)  NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  address_token        VARCHAR(40)  UNIQUE,
  phone                VARCHAR(32)  UNIQUE,
  link_code            VARCHAR(12)  UNIQUE,
  link_code_expires_at TIMESTAMP WITH TIME ZONE,
  linked_at            TIMESTAMP WITH TIME ZONE,
  last_used_at         TIMESTAMP WITH TIME ZONE,
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, channel)
);

ALTER TABLE inbox_items DROP CONSTRAINT IF EXISTS inbox_items_source_check;
ALTER TABLE inbox_items ADD CONSTRAINT inbox_items_source_check
  CHECK (source IN ('manual', 'quick_add', 'ai_capture', 'connector', 'email', 'whatsapp'));
