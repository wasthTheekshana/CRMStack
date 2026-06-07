ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS lead_limit INTEGER DEFAULT NULL;

-- Set per-plan defaults for existing tenants (NULL = unlimited)
UPDATE tenants SET lead_limit = 500  WHERE plan = 'starter'  AND lead_limit IS NULL;
UPDATE tenants SET lead_limit = 5000 WHERE plan = 'business' AND lead_limit IS NULL;
-- enterprise stays NULL (unlimited)
