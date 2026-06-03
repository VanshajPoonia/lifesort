ALTER TABLE users
  ADD COLUMN IF NOT EXISTS journal_intention_1 VARCHAR(40) DEFAULT 'Work',
  ADD COLUMN IF NOT EXISTS journal_intention_2 VARCHAR(40) DEFAULT 'Personal',
  ADD COLUMN IF NOT EXISTS journal_intention_3 VARCHAR(40) DEFAULT 'Family';

UPDATE users
SET
  journal_intention_1 = COALESCE(NULLIF(TRIM(journal_intention_1), ''), 'Work'),
  journal_intention_2 = COALESCE(NULLIF(TRIM(journal_intention_2), ''), 'Personal'),
  journal_intention_3 = COALESCE(NULLIF(TRIM(journal_intention_3), ''), 'Family');
