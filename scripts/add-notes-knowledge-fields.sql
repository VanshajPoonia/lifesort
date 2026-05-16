-- Add folders, tags, and pinned state for the Notes knowledge area.
-- Run this against the target database after confirming the environment.

CREATE TABLE IF NOT EXISTS note_folders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES note_folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

UPDATE notes
SET tags = '{}'
WHERE tags IS NULL;

UPDATE notes
SET is_pinned = FALSE
WHERE is_pinned IS NULL;

CREATE INDEX IF NOT EXISTS idx_note_folders_user_name ON note_folders(user_id, name);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_pinned ON notes(user_id, is_pinned, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN(tags);
