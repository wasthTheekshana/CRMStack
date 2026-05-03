-- 015_add_leads_created_at.sql
-- Adds created_at to leads tables created before the column was part of
-- 002_create_leads.sql. ADD COLUMN IF NOT EXISTS is a no-op when it exists.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Back-fill rows that got NULL from the ADD COLUMN (existing rows with no value)
UPDATE leads SET created_at = updated_at WHERE created_at IS NULL;

-- Enforce NOT NULL and default going forward
ALTER TABLE leads ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE leads ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
