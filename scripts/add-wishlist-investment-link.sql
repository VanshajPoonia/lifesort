-- Add wishlist_item_id column to investments table to track which wishlist item was converted
ALTER TABLE investments ADD COLUMN IF NOT EXISTS wishlist_item_id INTEGER REFERENCES wishlist_items(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_investments_wishlist_item_id ON investments(wishlist_item_id);
