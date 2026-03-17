-- Add target_value and current_value columns to goals table for numeric progress tracking
ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_value NUMERIC;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS current_value NUMERIC DEFAULT 0;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS value_unit VARCHAR(50);

-- Update existing goals: if they have progress > 0, set target_value to 100 and current_value to progress
-- This treats existing percentage progress as if target was 100
UPDATE goals 
SET target_value = 100, current_value = progress, value_unit = '%'
WHERE target_value IS NULL AND progress > 0;
