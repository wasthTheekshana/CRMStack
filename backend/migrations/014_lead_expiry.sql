-- backend/migrations/014_lead_expiry.sql
-- Lead expiry dates and reminder tracking flags.
-- One row per lead. Upsert resets all flags when date changes.

CREATE TABLE IF NOT EXISTS lead_expiry (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expiry_date      DATE NOT NULL,
  set_by           UUID NOT NULL REFERENCES users(id),
  notified_7d      BOOLEAN NOT NULL DEFAULT FALSE,
  notified_5d      BOOLEAN NOT NULL DEFAULT FALSE,
  notified_2d      BOOLEAN NOT NULL DEFAULT FALSE,
  notified_1d      BOOLEAN NOT NULL DEFAULT FALSE,
  notified_expired BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS lead_expiry_tenant_date_idx
  ON lead_expiry(tenant_id, expiry_date);
