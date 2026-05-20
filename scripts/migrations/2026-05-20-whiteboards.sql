-- LifeSort collaborative whiteboards
-- Forward-only additive migration. Do not run automatically.

CREATE TABLE IF NOT EXISTS whiteboards (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  liveblocks_room_id VARCHAR(255) UNIQUE NOT NULL,
  visibility VARCHAR(30) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public_link')),
  share_token VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_opened_at TIMESTAMP,
  archived_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whiteboard_collaborators (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  whiteboard_id VARCHAR(255) NOT NULL REFERENCES whiteboards(id) ON DELETE CASCADE,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  role VARCHAR(30) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whiteboards_share_token_unique
  ON whiteboards(share_token)
  WHERE share_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whiteboards_user_id ON whiteboards(user_id);
CREATE INDEX IF NOT EXISTS idx_whiteboards_liveblocks_room_id ON whiteboards(liveblocks_room_id);
CREATE INDEX IF NOT EXISTS idx_whiteboards_share_token ON whiteboards(share_token);
CREATE INDEX IF NOT EXISTS idx_whiteboard_collaborators_whiteboard_id ON whiteboard_collaborators(whiteboard_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_collaborators_user_id ON whiteboard_collaborators(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whiteboard_collaborators_board_user_unique
  ON whiteboard_collaborators(whiteboard_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whiteboard_collaborators_board_email_unique
  ON whiteboard_collaborators(whiteboard_id, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whiteboard_collaborators_one_owner
  ON whiteboard_collaborators(whiteboard_id)
  WHERE role = 'owner';
