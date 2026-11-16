-- Life Kits (AI_BUILD_PLAN.md Part 0, Stage 3). Approved by the user on 2026-11-16.
--
-- life_kits: one row per kit a person starts. Kit definitions live in lib/life-kits.ts;
-- kit_key names one of them. anchor_date is the kit's key date (semester start, moving
-- day...). details holds kit inputs such as a target amount or what it's for.
--
-- life_kit_items: every row a kit created, so pausing and removing touch exactly those.
-- kit_updated_at is the item's updated_at right after the kit last wrote it. A later
-- updated_at means the person changed it, so removal leaves it alone.
--
-- Additive only, so it is safe to run before the code that uses it is deployed.

CREATE TABLE IF NOT EXISTS life_kits (
  id           VARCHAR(64)  PRIMARY KEY,
  user_id      VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kit_key      VARCHAR(50)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  anchor_date  DATE         NOT NULL,
  start_date   DATE         NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'finished')),
  paused_on    DATE,
  details      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_kits_user_status ON life_kits(user_id, status);
CREATE INDEX IF NOT EXISTS idx_life_kits_life_area ON life_kits(life_area_id);

CREATE TABLE IF NOT EXISTS life_kit_items (
  id             SERIAL       PRIMARY KEY,
  kit_id         VARCHAR(64)  NOT NULL REFERENCES life_kits(id) ON DELETE CASCADE,
  item_type      VARCHAR(30)  NOT NULL CHECK (item_type IN ('task', 'goal', 'habit', 'budget_category', 'vault_item')),
  item_id        INTEGER      NOT NULL,
  planned_date   DATE,
  kit_updated_at TIMESTAMP,
  moved_by_pause BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (kit_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_life_kit_items_kit ON life_kit_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_life_kit_items_item ON life_kit_items(item_type, item_id);
