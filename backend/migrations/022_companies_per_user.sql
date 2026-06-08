-- Companies become per-user: each user owns their own company records.
-- Shared company rows (multiple users' leads pointing to same company) are split
-- into separate rows, one per owner. Unique index moves from (tenant, name) to
-- (tenant, owner, name) so each user can have their own "Acme Corp".

ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);

DO $$
DECLARE
  comp      RECORD;
  owner_rec RECORD;
  is_first  BOOLEAN;
  new_id    UUID;
BEGIN
  -- For each active company that has at least one active lead:
  -- assign the earliest lead's owner to the existing row,
  -- create new rows for any additional owners.
  FOR comp IN
    SELECT DISTINCT c.id, c.tenant_id, c.name, c.website, c.phone, c.address, c.notes
    FROM companies c
    WHERE c.is_deleted = FALSE
      AND EXISTS (SELECT 1 FROM leads l WHERE l.company_id = c.id AND l.is_deleted = FALSE)
  LOOP
    is_first := TRUE;

    FOR owner_rec IN
      SELECT l.owner_id
      FROM leads l
      WHERE l.company_id = comp.id AND l.is_deleted = FALSE
      GROUP BY l.owner_id
      ORDER BY MIN(l.created_at), l.owner_id
    LOOP
      IF is_first THEN
        UPDATE companies SET owner_id = owner_rec.owner_id WHERE id = comp.id;
        is_first := FALSE;
      ELSE
        INSERT INTO companies (tenant_id, owner_id, name, website, phone, address, notes)
        VALUES (comp.tenant_id, owner_rec.owner_id, comp.name, comp.website, comp.phone, comp.address, comp.notes)
        RETURNING id INTO new_id;

        UPDATE leads SET company_id = new_id
        WHERE company_id = comp.id AND owner_id = owner_rec.owner_id AND is_deleted = FALSE;
      END IF;
    END LOOP;
  END LOOP;

  -- Companies with no active leads get assigned to the tenant's first admin.
  UPDATE companies c
  SET owner_id = (
    SELECT u.id FROM users u
    WHERE u.tenant_id = c.tenant_id AND u.role = 'admin'
    ORDER BY u.created_at, u.id
    LIMIT 1
  )
  WHERE c.owner_id IS NULL;
END $$;

ALTER TABLE companies ALTER COLUMN owner_id SET NOT NULL;

DROP INDEX IF EXISTS uidx_companies_tenant_lower_name;

CREATE UNIQUE INDEX uidx_companies_owner_lower_name
  ON companies (tenant_id, owner_id, lower(name))
  WHERE is_deleted = FALSE;
