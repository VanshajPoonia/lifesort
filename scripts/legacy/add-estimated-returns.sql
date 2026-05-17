-- Add estimated_return_rate column to investments table
ALTER TABLE investments ADD COLUMN IF NOT EXISTS estimated_return_rate DECIMAL(5, 2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN investments.estimated_return_rate IS 'Annual estimated rate of return as a percentage (e.g., 7.5 for 7.5%)';
