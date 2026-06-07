-- Unique partial index to prevent duplicate company names per tenant
-- Enforces uniqueness on (tenant_id, lower(name)) for non-deleted companies
-- Enables ON CONFLICT in findOrCreateCompany to be race-safe
CREATE UNIQUE INDEX IF NOT EXISTS uidx_companies_tenant_lower_name
  ON companies (tenant_id, lower(name))
  WHERE is_deleted = FALSE;

-- Fix case-sensitive back-fill from migration 020
-- Some leads may still have company_id = NULL if their company_name differed in case
UPDATE leads l
SET company_id = c.id
FROM companies c
WHERE c.tenant_id = l.tenant_id
  AND lower(c.name) = lower(l.company_name)
  AND l.company_id IS NULL
  AND l.is_deleted = FALSE;
