-- Fix existing users who have NULL onboarding_completed
-- Set them to true since they are existing users who have already used the app

UPDATE users 
SET onboarding_completed = true 
WHERE onboarding_completed IS NULL;

-- Also set default for the column going forward
ALTER TABLE users 
ALTER COLUMN onboarding_completed SET DEFAULT false;
