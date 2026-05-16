-- Add Life Areas as an optional organizing layer across LifeSort modules.
-- Safe to run multiple times. Existing records remain unassigned.

BEGIN;

CREATE TABLE IF NOT EXISTS life_areas (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(50) NOT NULL DEFAULT 'Target',
  color VARCHAR(20) NOT NULL DEFAULT '#2563EB',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_life_areas_user_order ON life_areas(user_id, sort_order, name);

INSERT INTO life_areas (user_id, name, icon, color, description, sort_order)
SELECT users.id, seed.name, seed.icon, seed.color, seed.description, seed.sort_order
FROM users
CROSS JOIN (
  VALUES
    ('Work', 'Briefcase', '#2563EB', 'Career, job responsibilities, and professional projects', 0),
    ('School', 'GraduationCap', '#7C3AED', 'Classes, coursework, exams, and academic planning', 1),
    ('Finance', 'Wallet', '#059669', 'Money, budgets, income, investing, and financial goals', 2),
    ('Health', 'HeartPulse', '#DC2626', 'Medical care, wellness, appointments, and health habits', 3),
    ('Fitness', 'Dumbbell', '#EA580C', 'Training, movement, strength, and physical goals', 4),
    ('Family', 'Home', '#DB2777', 'Family responsibilities, plans, and relationships', 5),
    ('Friends', 'Users', '#0891B2', 'Friendships, social plans, and community', 6),
    ('Personal', 'User', '#4F46E5', 'Personal admin, routines, and self-management', 7),
    ('Learning', 'BookOpen', '#9333EA', 'Skills, reading, courses, and curiosity', 8),
    ('Business', 'Building2', '#0F766E', 'Business ideas, operations, clients, and growth', 9),
    ('Home', 'House', '#CA8A04', 'Home projects, maintenance, chores, and space planning', 10),
    ('Travel', 'Plane', '#0284C7', 'Trips, itineraries, packing, and places to go', 11),
    ('Creativity', 'Palette', '#C026D3', 'Creative projects, art, writing, and making things', 12)
) AS seed(name, icon, color, description, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE wishlist_items ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE budget_categories ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE income_sources ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;
ALTER TABLE custom_sections ADD COLUMN IF NOT EXISTS life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_life_area_id ON tasks(life_area_id);
CREATE INDEX IF NOT EXISTS idx_goals_life_area_id ON goals(life_area_id);
CREATE INDEX IF NOT EXISTS idx_notes_life_area_id ON notes(life_area_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_life_area_id ON wishlist_items(life_area_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_life_area_id ON budget_categories(life_area_id);
CREATE INDEX IF NOT EXISTS idx_income_sources_life_area_id ON income_sources(life_area_id);
CREATE INDEX IF NOT EXISTS idx_investments_life_area_id ON investments(life_area_id);
CREATE INDEX IF NOT EXISTS idx_custom_sections_life_area_id ON custom_sections(life_area_id);

COMMIT;
