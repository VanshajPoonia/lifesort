-- Fix remaining INTEGER user_id columns to VARCHAR(255)

-- Fix custom_sections table
ALTER TABLE custom_sections ALTER COLUMN user_id TYPE VARCHAR(255);

-- Fix user_links table  
ALTER TABLE user_links ALTER COLUMN user_id TYPE VARCHAR(255);
