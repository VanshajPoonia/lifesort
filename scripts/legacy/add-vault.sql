-- add-vault.sql
--
-- Idempotent migration for the Life Vault / Important Info feature.
-- Safe to run multiple times — every statement uses IF NOT EXISTS guards.

BEGIN;

-- ── Vault Items ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_items (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'other',
    -- documents | subscriptions | warranty | insurance | vehicle
    -- home | medical | education | work | other
  description TEXT,
  notes TEXT,
  start_date DATE,
  expiry_date DATE,
  renewal_date DATE,
  reminder_date DATE,
  url VARCHAR(1000),
  life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_items_user_id ON vault_items(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_items_user_category ON vault_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_vault_items_user_expiry ON vault_items(user_id, expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vault_items_user_renewal ON vault_items(user_id, renewal_date) WHERE renewal_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vault_items_life_area_id ON vault_items(life_area_id);

COMMIT;
