-- Add description and fields columns to custom_sections
-- fields is a JSONB array of field definitions: [{id, name, type, options?, required?}]
ALTER TABLE custom_sections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE custom_sections ADD COLUMN IF NOT EXISTS fields JSONB NOT NULL DEFAULT '[]';

-- Records table for flexible field-based entries within a custom section
CREATE TABLE IF NOT EXISTS custom_section_records (
  id SERIAL PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES custom_sections(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_section_records_section_id ON custom_section_records(section_id);
