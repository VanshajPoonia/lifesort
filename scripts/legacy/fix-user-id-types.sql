-- Fix user_id types to match UUID from auth system
-- Drop all foreign key constraints first
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_user_id_fkey;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
ALTER TABLE nuke_goals DROP CONSTRAINT IF EXISTS nuke_goals_user_id_fkey;
ALTER TABLE pomodoro_sessions DROP CONSTRAINT IF EXISTS pomodoro_sessions_user_id_fkey;
ALTER TABLE wishlist_items DROP CONSTRAINT IF EXISTS wishlist_items_user_id_fkey;
ALTER TABLE investments DROP CONSTRAINT IF EXISTS investments_user_id_fkey;
ALTER TABLE income_sources DROP CONSTRAINT IF EXISTS income_sources_user_id_fkey;
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_user_id_fkey;

-- Change users.id from SERIAL to UUID
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE users ALTER COLUMN id TYPE VARCHAR(255);
ALTER TABLE users ADD PRIMARY KEY (id);

-- Change all user_id columns to VARCHAR(255) to match UUID
ALTER TABLE sessions ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE goals ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE tasks ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE nuke_goals ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE pomodoro_sessions ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE wishlist_items ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE investments ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE income_sources ALTER COLUMN user_id TYPE VARCHAR(255);
ALTER TABLE calendar_events ALTER COLUMN user_id TYPE VARCHAR(255);

-- Recreate foreign key constraints
ALTER TABLE sessions ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE goals ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE nuke_goals ADD CONSTRAINT nuke_goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE pomodoro_sessions ADD CONSTRAINT pomodoro_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE wishlist_items ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE investments ADD CONSTRAINT investments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE income_sources ADD CONSTRAINT income_sources_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
