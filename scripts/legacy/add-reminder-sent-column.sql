-- Add reminder_sent column to goals table to track if deadline reminder was sent
ALTER TABLE goals ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE;
