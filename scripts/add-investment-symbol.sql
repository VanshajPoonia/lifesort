-- Add symbol and quantity columns to investments table
ALTER TABLE investments ADD COLUMN IF NOT EXISTS symbol VARCHAR(50);
ALTER TABLE investments ADD COLUMN IF NOT EXISTS quantity DECIMAL(20, 8);
