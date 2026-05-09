-- Allow 'trial' as a valid tenant status
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active', 'trial', 'suspended', 'cancelled'));

-- Track which expiry-warning emails have been sent (reset whenever trial is re-enabled)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_notified_7d BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_notified_5d BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_notified_2d BOOLEAN NOT NULL DEFAULT FALSE;
