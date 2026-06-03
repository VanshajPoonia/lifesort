ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(3) DEFAULT 'USD';

UPDATE users
SET preferred_currency = COALESCE(NULLIF(TRIM(preferred_currency), ''), 'USD');

ALTER TABLE budget_goals
  ADD COLUMN IF NOT EXISTS wishlist_item_id INTEGER REFERENCES wishlist_items(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_goals_user_wishlist
  ON budget_goals(user_id, wishlist_item_id)
  WHERE wishlist_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS liabilities (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  interest_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  monthly_payment DECIMAL(15, 2) NOT NULL DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);
