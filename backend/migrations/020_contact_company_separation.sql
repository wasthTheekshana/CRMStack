-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  website     TEXT,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant_id  ON companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_name       ON companies(tenant_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_companies_is_deleted ON companies(tenant_id, is_deleted);

-- Contacts table (global contacts, linked to a company)
CREATE TABLE IF NOT EXISTS contacts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id   UUID        REFERENCES companies(id) ON DELETE SET NULL,
  name         TEXT        NOT NULL,
  phone        TEXT,
  email        TEXT,
  designation  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id  ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);

-- Add company_id FK to leads (nullable)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);

-- Data migration: create one company per distinct (tenant_id, company_name)
INSERT INTO companies (id, tenant_id, name, created_at, updated_at)
SELECT
  gen_random_uuid(),
  tenant_id,
  company_name,
  MIN(created_at),
  NOW()
FROM leads
WHERE is_deleted = FALSE
  AND company_name IS NOT NULL
  AND company_name <> ''
GROUP BY tenant_id, company_name
ON CONFLICT DO NOTHING;

-- Back-fill leads.company_id
UPDATE leads l
SET company_id = c.id
FROM companies c
WHERE c.tenant_id = l.tenant_id
  AND c.name      = l.company_name
  AND l.company_id IS NULL;

-- Data migration: populate contacts from leads.contacts JSONB
INSERT INTO contacts (tenant_id, company_id, name, phone, email, designation, created_at)
SELECT
  l.tenant_id,
  l.company_id,
  elem->>'name',
  NULLIF(elem->>'phone', ''),
  NULLIF(elem->>'email', ''),
  NULLIF(elem->>'designation', ''),
  l.created_at
FROM leads l,
     jsonb_array_elements(l.contacts) AS elem
WHERE l.is_deleted = FALSE
  AND l.contacts IS NOT NULL
  AND jsonb_typeof(l.contacts) = 'array'
  AND (elem->>'name') IS NOT NULL
  AND (elem->>'name') <> '';
