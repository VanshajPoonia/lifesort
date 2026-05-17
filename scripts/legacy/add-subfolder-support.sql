-- Add parent_id column for subfolder support
ALTER TABLE link_folders 
ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES link_folders(id) ON DELETE SET NULL;

-- Create index for faster parent lookup
CREATE INDEX IF NOT EXISTS idx_link_folders_parent_id ON link_folders(parent_id);
