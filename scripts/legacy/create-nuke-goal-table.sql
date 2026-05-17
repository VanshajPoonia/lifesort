-- Create nuke_goals table for storing user's main focus goal
CREATE TABLE IF NOT EXISTS nuke_goals (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    deadline DATE,
    milestones JSONB DEFAULT '[]'::jsonb,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS idx_nuke_goals_user_id ON nuke_goals(user_id);
