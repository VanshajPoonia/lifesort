-- Add cached price columns to investments table
ALTER TABLE investments ADD COLUMN IF NOT EXISTS cached_price DECIMAL(15,2);
ALTER TABLE investments ADD COLUMN IF NOT EXISTS last_price_fetch TIMESTAMP;
