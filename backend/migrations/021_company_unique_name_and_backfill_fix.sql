-- Step 1a: Re-point leads from duplicate companies to the canonical (earliest) row
UPDATE leads l
SET company_id = keep.id
FROM companies dup
JOIN (
  SELECT DISTINCT ON (tenant_id, lower(name))
    id, tenant_id, lower(name) AS lname
  FROM companies
  WHERE is_deleted = FALSE
  ORDER BY tenant_id, lower(name), created_at, id
) keep ON keep.tenant_id = dup.tenant_id
      AND keep.lname      = lower(dup.name)
      AND keep.id        <> dup.id
WHERE dup.is_deleted = FALSE
  AND l.company_id = dup.id;

-- Step 1b: Re-point contacts from duplicate companies to the canonical row
UPDATE contacts c
SET company_id = keep.id
FROM companies dup
JOIN (
  SELECT DISTINCT ON (tenant_id, lower(name))
    id, tenant_id, lower(name) AS lname
  FROM companies
  WHERE is_deleted = FALSE
  ORDER BY tenant_id, lower(name), created_at, id
) keep ON keep.tenant_id = dup.tenant_id
      AND keep.lname      = lower(dup.name)
      AND keep.id        <> dup.id
WHERE dup.is_deleted = FALSE
  AND c.company_id = dup.id;

-- Step 1c: Soft-delete the duplicate company rows
UPDATE companies dup
SET is_deleted = TRUE, deleted_at = NOW()
FROM (
  SELECT DISTINCT ON (tenant_id, lower(name))
    id AS keep_id, tenant_id, lower(name) AS lname
  FROM companies
  WHERE is_deleted = FALSE
  ORDER BY tenant_id, lower(name), created_at, id
) keep
WHERE keep.tenant_id = dup.tenant_id
  AND keep.lname      = lower(dup.name)
  AND keep.keep_id   <> dup.id
  AND dup.is_deleted  = FALSE;

-- Step 2: Unique partial index — safe now, no case-variant duplicates remain
CREATE UNIQUE INDEX IF NOT EXISTS uidx_companies_tenant_lower_name
  ON companies (tenant_id, lower(name))
  WHERE is_deleted = FALSE;

-- Step 3: Back-fill company_id on leads where casing prevented the 020 match
UPDATE leads l
SET company_id = c.id
FROM companies c
WHERE c.tenant_id   = l.tenant_id
  AND lower(c.name) = lower(l.company_name)
  AND l.company_id  IS NULL
  AND l.is_deleted  = FALSE
  AND c.is_deleted  = FALSE;
