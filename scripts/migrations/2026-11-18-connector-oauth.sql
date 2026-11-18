-- ChatGPT and Claude connector (AI_BUILD_PLAN.md Part 0, part C). Approved by the
-- user on 2026-11-18 as part of building the four parked features.
--
-- Additive only, so it is safe to run before the code that uses it is deployed.
-- oauth_clients: apps that registered themselves (dynamic client registration).
-- oauth_grants: one-time codes, access tokens and refresh tokens, stored as SHA-256 hashes.
-- inbox_items.source also gains the values the connector and capture channels write:
-- connector, email and whatsapp.

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id     VARCHAR(64)  PRIMARY KEY,
  client_name   VARCHAR(200) NOT NULL,
  redirect_uris TEXT[]       NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS oauth_grants (
  id             SERIAL PRIMARY KEY,
  user_id        VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      VARCHAR(64)  NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  kind           VARCHAR(10)  NOT NULL CHECK (kind IN ('code', 'access', 'refresh')),
  token_hash     CHAR(64)     NOT NULL UNIQUE,
  redirect_uri   TEXT,
  code_challenge VARCHAR(128),
  expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at        TIMESTAMP WITH TIME ZONE,
  last_used_at   TIMESTAMP WITH TIME ZONE,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_grants_user_client ON oauth_grants(user_id, client_id);

ALTER TABLE inbox_items DROP CONSTRAINT IF EXISTS inbox_items_source_check;
ALTER TABLE inbox_items ADD CONSTRAINT inbox_items_source_check
  CHECK (source IN ('manual', 'quick_add', 'ai_capture', 'connector', 'email', 'whatsapp'));
