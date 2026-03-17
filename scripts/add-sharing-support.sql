-- Add sharing support to link_folders
ALTER TABLE link_folders ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE link_folders ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
ALTER TABLE link_folders ADD COLUMN IF NOT EXISTS share_permission VARCHAR(20) DEFAULT 'private';

-- Add sharing support to user_links (for individual links/images)
ALTER TABLE user_links ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
ALTER TABLE user_links ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
ALTER TABLE user_links ADD COLUMN IF NOT EXISTS share_permission VARCHAR(20) DEFAULT 'private';
ALTER TABLE user_links ADD COLUMN IF NOT EXISTS link_type VARCHAR(20) DEFAULT 'link';
ALTER TABLE user_links ADD COLUMN IF NOT EXISTS file_data TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_link_folders_share_token ON link_folders(share_token);
CREATE INDEX IF NOT EXISTS idx_user_links_share_token ON user_links(share_token);

-- share_permission can be: 'private', 'view', 'public'
-- link_type can be: 'link', 'image', 'video'
