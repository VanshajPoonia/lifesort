-- Add sidebar_preferences column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS sidebar_preferences JSONB DEFAULT '{
  "dashboard": true,
  "calendar": true,
  "goals": true,
  "tasks": true,
  "nuke": true,
  "pomodoro": true,
  "notes": true,
  "wishlist": true,
  "investments": true,
  "income": true,
  "links": true,
  "daily_content": true,
  "custom_sections": true,
  "ai_assistant": true
}'::jsonb;
