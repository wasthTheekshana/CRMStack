# Contact & Company Separation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Companies and Contacts into first-class entities so one company can have many contacts and many deals, replacing the current approach where each lead stores an independent `company_name` text field and a JSONB `contacts` array.

**Architecture:** Add `companies` and `contacts` tables, FK `company_id` on leads, and a data migration. Leads keep their JSONB `contacts` array unchanged (deal-level contacts). New CRUD APIs and pages. LeadForm gains a company picker (autocomplete + inline create). Non-breaking: existing company_name text is preserved as a computed JOIN field.

**Tech Stack:** Express + PostgreSQL, React 18 + TypeScript + Vite, shadcn/ui, Zustand, `apiFetch` / `query` patterns.

---

## File Map

**New files:**
- `backend/migrations/020_contact_company_separation.sql`
- `backend/src/models/companyModel.ts`
- `backend/src/controllers/companyController.ts`
- `backend/src/routes/companies.ts`
- `backend/src/models/contactModel.ts`
- `backend/src/controllers/contactController.ts`
- `backend/src/routes/contacts.ts`
- `frontend/src/services/companyService.ts`
- `frontend/src/services/contactService.ts`
- `frontend/src/pages/shared/CompaniesPage.tsx`
- `frontend/src/pages/shared/ContactsPage.tsx`
- `frontend/src/components/leads/CompanyPicker.tsx`

**Modified files:**
- `backend/src/routes/index.ts` — register company + contact routes
- `backend/src/models/leadModel.ts` — add `companyId` to interface + JOIN
- `backend/src/controllers/leadController.ts` — accept `companyId` in create/update
- `frontend/src/models/index.ts` — add Company + Contact types, add `companyId` to Lead
- `frontend/src/components/leads/LeadForm.tsx` — replace companyName text with CompanyPicker
- `frontend/src/App.tsx` — add Companies + Contacts routes
- `frontend/src/components/layout/Sidebar.tsx` — add Companies + Contacts nav links

---

## Task 1: Database Migration

**Files:**
- Create: `backend/migrations/020_contact_company_separation.sql`

- [ ] **Step 1: Create migration file**

```sql
-- backend/migrations/020_contact_company_separation.sql

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

-- Add company_id FK to leads (nullable — existing leads migrate below)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_company_id ON leads(company_id);

-- Data migration: create one company row per distinct (tenant_id, company_name)
-- Uses the first lead's created_at as the company's created_at
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

-- Back-fill leads.company_id from the companies we just created
UPDATE leads l
SET company_id = c.id
FROM companies c
WHERE c.tenant_id = l.tenant_id
  AND c.name      = l.company_name
  AND l.company_id IS NULL;

-- Data migration: populate contacts table from leads.contacts JSONB
-- Each element in the JSONB array becomes a row in contacts
-- Skips contacts that have no name
INSERT INTO contacts (id, tenant_id, company_id, name, phone, email, designation, created_at)
SELECT
  COALESCE((elem->>'id')::uuid, gen_random_uuid()),
  l.tenant_id,
  l.company_id,
  elem->>'name',
  elem->>'phone',
  elem->>'email',
  elem->>'designation',
  l.created_at
FROM leads l,
     jsonb_array_elements(l.contacts) AS elem
WHERE l.is_deleted = FALSE
  AND l.contacts IS NOT NULL
  AND jsonb_typeof(l.contacts) = 'array'
  AND (elem->>'name') IS NOT NULL
  AND (elem->>'name') <> ''
ON CONFLICT (id) DO NOTHING;
```

> **Note on `ON CONFLICT (id)` for contacts:** The JSONB contact IDs are UUIDs assigned by the frontend. If the same contact UUID appears in multiple leads (e.g. same person linked to multiple deals), `ON CONFLICT` prevents duplicates. This requires a UNIQUE constraint on `contacts.id` which is already guaranteed by the PRIMARY KEY.

- [ ] **Step 2: Apply migration to running Docker DB**

```powershell
docker compose -f "D:\Project\Sale Funnel\docker-compose.yml" exec postgres psql -U crmstack -d crmstack -f /dev/stdin < "D:\Project\Sale Funnel\backend\migrations\020_contact_company_separation.sql"
```

If that doesn't work (stdin piping issue on Windows PowerShell), use:
```powershell
$sql = Get-Content "D:\Project\Sale Funnel\backend\migrations\020_contact_company_separation.sql" -Raw
docker compose exec postgres psql -U crmstack -d crmstack -c $sql
```

Or copy to the container:
```powershell
docker compose cp "D:\Project\Sale Funnel\backend\migrations\020_contact_company_separation.sql" postgres:/tmp/020.sql
docker compose exec postgres psql -U crmstack -d crmstack -f /tmp/020.sql
```

- [ ] **Step 3: Verify**

```powershell
docker compose exec postgres psql -U crmstack -d crmstack -c "\dt companies; \dt contacts; SELECT COUNT(*) FROM companies; SELECT COUNT(*) FROM contacts;"
```

Expected: both tables exist, row counts > 0 (if leads exist).

- [ ] **Step 4: Commit**

```powershell
cd "D:\Project\Sale Funnel"
git add backend/migrations/020_contact_company_separation.sql
git commit -m "feat(companies): add companies and contacts tables with lead data migration"
```

---

## Task 2: Company Backend (Model + Controller + Routes)

**Files:**
- Create: `backend/src/models/companyModel.ts`
- Create: `backend/src/controllers/companyController.ts`
- Create: `backend/src/routes/companies.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create `backend/src/models/companyModel.ts`**

```typescript
import { query } from '../config/db'

export interface Company {
  id:        string
  tenantId:  string
  name:      string
  website:   string | null
  phone:     string | null
  address:   string | null
  notes:     string | null
  createdAt: string
  updatedAt: string
  isDeleted: boolean
  deletedAt: string | null
  leadCount?: number
}

const mapRow = (r: Record<string, unknown>): Company => ({
  id:        r.id        as string,
  tenantId:  r.tenant_id as string,
  name:      r.name      as string,
  website:   (r.website  as string) ?? null,
  phone:     (r.phone    as string) ?? null,
  address:   (r.address  as string) ?? null,
  notes:     (r.notes    as string) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  isDeleted: r.is_deleted as boolean,
  deletedAt: (r.deleted_at as string) ?? null,
  leadCount: r.lead_count !== undefined ? parseInt(r.lead_count as string, 10) : undefined,
})

export async function findAllCompanies(tenantId: string): Promise<Company[]> {
  const result = await query(
    `SELECT c.*,
            COUNT(l.id) FILTER (WHERE l.is_deleted = FALSE) AS lead_count
       FROM companies c
       LEFT JOIN leads l ON l.company_id = c.id
      WHERE c.tenant_id = $1
        AND c.is_deleted = FALSE
      GROUP BY c.id
      ORDER BY c.name ASC`,
    [tenantId]
  )
  return result.rows.map(mapRow)
}

export async function findCompanyById(id: string, tenantId: string): Promise<Company | null> {
  const result = await query(
    `SELECT c.*,
            COUNT(l.id) FILTER (WHERE l.is_deleted = FALSE) AS lead_count
       FROM companies c
       LEFT JOIN leads l ON l.company_id = c.id
      WHERE c.id = $1 AND c.tenant_id = $2
      GROUP BY c.id`,
    [id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function createCompany(data: {
  tenantId: string
  name:     string
  website?: string | null
  phone?:   string | null
  address?: string | null
  notes?:   string | null
}): Promise<Company> {
  const result = await query(
    `INSERT INTO companies (tenant_id, name, website, phone, address, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.tenantId, data.name, data.website ?? null, data.phone ?? null,
     data.address ?? null, data.notes ?? null]
  )
  return mapRow(result.rows[0])
}

export async function updateCompany(id: string, tenantId: string, data: {
  name?:    string
  website?: string | null
  phone?:   string | null
  address?: string | null
  notes?:   string | null
}): Promise<Company | null> {
  const result = await query(
    `UPDATE companies SET
       name      = COALESCE($1, name),
       website   = COALESCE($2, website),
       phone     = COALESCE($3, phone),
       address   = COALESCE($4, address),
       notes     = COALESCE($5, notes),
       updated_at = NOW()
     WHERE id = $6 AND tenant_id = $7 AND is_deleted = FALSE
     RETURNING *`,
    [data.name, data.website, data.phone, data.address, data.notes, id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function deleteCompany(id: string, tenantId: string): Promise<boolean> {
  const result = await query(
    `UPDATE companies SET is_deleted = TRUE, deleted_at = NOW()
      WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
    [id, tenantId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function findOrCreateCompany(tenantId: string, name: string): Promise<Company> {
  const existing = await query(
    `SELECT * FROM companies WHERE tenant_id = $1 AND lower(name) = lower($2) AND is_deleted = FALSE LIMIT 1`,
    [tenantId, name]
  )
  if (existing.rows[0]) return mapRow(existing.rows[0])
  return createCompany({ tenantId, name })
}
```

- [ ] **Step 2: Create `backend/src/controllers/companyController.ts`**

```typescript
import { Request, Response } from 'express'
import {
  findAllCompanies, findCompanyById,
  createCompany, updateCompany, deleteCompany,
} from '../models/companyModel'
import { findContactsByCompany } from '../models/contactModel'

export async function listCompanies(req: Request, res: Response) {
  try {
    const companies = await findAllCompanies(req.user!.tenantId)
    res.json(companies)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function getCompany(req: Request, res: Response) {
  try {
    const company = await findCompanyById(req.params.id, req.user!.tenantId)
    if (!company) { res.status(404).json({ error: 'Not found' }); return }
    const contacts = await findContactsByCompany(req.params.id, req.user!.tenantId)
    res.json({ ...company, contacts })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function createCompanyHandler(req: Request, res: Response) {
  const { name, website, phone, address, notes } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  try {
    const company = await createCompany({
      tenantId: req.user!.tenantId,
      name: name.trim(),
      website: website ?? null,
      phone: phone ?? null,
      address: address ?? null,
      notes: notes ?? null,
    })
    res.status(201).json(company)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function updateCompanyHandler(req: Request, res: Response) {
  const { name, website, phone, address, notes } = req.body
  try {
    const updated = await updateCompany(req.params.id, req.user!.tenantId, {
      name: name?.trim(),
      website, phone, address, notes,
    })
    if (!updated) { res.status(404).json({ error: 'Not found' }); return }
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function deleteCompanyHandler(req: Request, res: Response) {
  try {
    const deleted = await deleteCompany(req.params.id, req.user!.tenantId)
    if (!deleted) { res.status(404).json({ error: 'Not found' }); return }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

- [ ] **Step 3: Create `backend/src/routes/companies.ts`**

```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import {
  listCompanies, getCompany, createCompanyHandler,
  updateCompanyHandler, deleteCompanyHandler,
} from '../controllers/companyController'

const router = Router()

router.get('/',    requireAuth, listCompanies)
router.get('/:id', requireAuth, getCompany)
router.post('/',   requireAuth, createCompanyHandler)
router.put('/:id', requireAuth, updateCompanyHandler)
router.delete('/:id', requireAuth, deleteCompanyHandler)

export default router
```

- [ ] **Step 4: Register in `backend/src/routes/index.ts`**

Read `index.ts`, add:
```typescript
import companyRoutes from './companies'
```
```typescript
router.use('/companies', companyRoutes)
```

- [ ] **Step 5: Verify TypeScript**

```powershell
cd "D:\Project\Sale Funnel\backend"; npx tsc --noEmit
```

Expected: no errors. Note: `findContactsByCompany` is imported in `companyController.ts` but the contact model doesn't exist yet — TypeScript will error until Task 3 is committed. To unblock: temporarily comment out the import + the line in `getCompany` that uses it, then restore in Task 3.

- [ ] **Step 6: Commit**

```powershell
cd "D:\Project\Sale Funnel"
git add backend/src/models/companyModel.ts backend/src/controllers/companyController.ts backend/src/routes/companies.ts backend/src/routes/index.ts
git commit -m "feat(companies): add company CRUD backend (model + controller + routes)"
```

---

## Task 3: Contact Backend (Model + Controller + Routes)

**Files:**
- Create: `backend/src/models/contactModel.ts`
- Create: `backend/src/controllers/contactController.ts`
- Create: `backend/src/routes/contacts.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/controllers/companyController.ts` — restore `findContactsByCompany`

- [ ] **Step 1: Create `backend/src/models/contactModel.ts`**

```typescript
import { query } from '../config/db'

export interface Contact {
  id:          string
  tenantId:    string
  companyId:   string | null
  name:        string
  phone:       string | null
  email:       string | null
  designation: string | null
  createdAt:   string
  updatedAt:   string
}

const mapRow = (r: Record<string, unknown>): Contact => ({
  id:          r.id          as string,
  tenantId:    r.tenant_id   as string,
  companyId:   (r.company_id as string) ?? null,
  name:        r.name        as string,
  phone:       (r.phone      as string) ?? null,
  email:       (r.email      as string) ?? null,
  designation: (r.designation as string) ?? null,
  createdAt:   r.created_at  as string,
  updatedAt:   r.updated_at  as string,
})

export async function findContactsByCompany(companyId: string, tenantId: string): Promise<Contact[]> {
  const result = await query(
    `SELECT * FROM contacts
      WHERE company_id = $1 AND tenant_id = $2
      ORDER BY name ASC`,
    [companyId, tenantId]
  )
  return result.rows.map(mapRow)
}

export async function findContactById(id: string, tenantId: string): Promise<Contact | null> {
  const result = await query(
    'SELECT * FROM contacts WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function createContact(data: {
  tenantId:    string
  companyId:   string | null
  name:        string
  phone?:      string | null
  email?:      string | null
  designation?: string | null
}): Promise<Contact> {
  const result = await query(
    `INSERT INTO contacts (tenant_id, company_id, name, phone, email, designation)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.tenantId, data.companyId, data.name,
     data.phone ?? null, data.email ?? null, data.designation ?? null]
  )
  return mapRow(result.rows[0])
}

export async function updateContact(id: string, tenantId: string, data: {
  name?:        string
  phone?:       string | null
  email?:       string | null
  designation?: string | null
  companyId?:   string | null
}): Promise<Contact | null> {
  const result = await query(
    `UPDATE contacts SET
       name        = COALESCE($1, name),
       phone       = COALESCE($2, phone),
       email       = COALESCE($3, email),
       designation = COALESCE($4, designation),
       company_id  = COALESCE($5, company_id),
       updated_at  = NOW()
     WHERE id = $6 AND tenant_id = $7
     RETURNING *`,
    [data.name, data.phone, data.email, data.designation, data.companyId, id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function deleteContact(id: string, tenantId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM contacts WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  )
  return (result.rowCount ?? 0) > 0
}
```

- [ ] **Step 2: Create `backend/src/controllers/contactController.ts`**

```typescript
import { Request, Response } from 'express'
import { findContactsByCompany, findContactById, createContact, updateContact, deleteContact } from '../models/contactModel'

export async function listContactsByCompany(req: Request, res: Response) {
  try {
    const contacts = await findContactsByCompany(req.params.companyId, req.user!.tenantId)
    res.json(contacts)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function createContactHandler(req: Request, res: Response) {
  const { companyId, name, phone, email, designation } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  try {
    const contact = await createContact({
      tenantId: req.user!.tenantId,
      companyId: companyId ?? null,
      name: name.trim(),
      phone: phone ?? null,
      email: email ?? null,
      designation: designation ?? null,
    })
    res.status(201).json(contact)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function updateContactHandler(req: Request, res: Response) {
  const { name, phone, email, designation, companyId } = req.body
  try {
    const updated = await updateContact(req.params.id, req.user!.tenantId, {
      name: name?.trim(), phone, email, designation, companyId,
    })
    if (!updated) { res.status(404).json({ error: 'Not found' }); return }
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function deleteContactHandler(req: Request, res: Response) {
  try {
    const deleted = await deleteContact(req.params.id, req.user!.tenantId)
    if (!deleted) { res.status(404).json({ error: 'Not found' }); return }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

- [ ] **Step 3: Create `backend/src/routes/contacts.ts`**

```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import {
  listContactsByCompany, createContactHandler,
  updateContactHandler, deleteContactHandler,
} from '../controllers/contactController'

const router = Router()

// GET /api/contacts?companyId=xxx — list contacts for a company
router.get('/', requireAuth, (req, res, next) => {
  req.params.companyId = req.query.companyId as string
  next()
}, listContactsByCompany)

router.post('/',    requireAuth, createContactHandler)
router.put('/:id',  requireAuth, updateContactHandler)
router.delete('/:id', requireAuth, deleteContactHandler)

export default router
```

- [ ] **Step 4: Register in `backend/src/routes/index.ts`**

Add:
```typescript
import contactRoutes from './contacts'
```
```typescript
router.use('/contacts', contactRoutes)
```

- [ ] **Step 5: Restore companyController.ts**

Open `backend/src/controllers/companyController.ts`. If you temporarily commented out `findContactsByCompany`, restore the import and the `getCompany` usage:
```typescript
import { findContactsByCompany } from '../models/contactModel'
```
And in `getCompany`:
```typescript
const contacts = await findContactsByCompany(req.params.id, req.user!.tenantId)
res.json({ ...company, contacts })
```

- [ ] **Step 6: Verify TypeScript**

```powershell
cd "D:\Project\Sale Funnel\backend"; npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```powershell
cd "D:\Project\Sale Funnel"
git add backend/src/models/contactModel.ts backend/src/controllers/contactController.ts backend/src/routes/contacts.ts backend/src/routes/index.ts backend/src/controllers/companyController.ts
git commit -m "feat(contacts): add contact CRUD backend (model + controller + routes)"
```

---

## Task 4: Update Lead Model + Controller

**Files:**
- Modify: `backend/src/models/leadModel.ts`
- Modify: `backend/src/controllers/leadController.ts`

- [ ] **Step 1: Update `mapLead` in `leadModel.ts`**

Add `companyId` to the `mapLead` function:
```typescript
export const mapLead = (row: Record<string, unknown>) => ({
  id:               row.id,
  companyId:        (row.company_id as string) ?? null,   // ADD THIS
  companyName:      row.company_name,
  // ... rest unchanged
})
```

- [ ] **Step 2: Update `findAllLeads` and `findLeadById` to JOIN company name**

Replace `SELECT *` with a JOIN so `company_name` is always populated even if only `company_id` is set:

```typescript
export async function findAllLeads(userId: string, tenantId: string, isAdmin: boolean) {
  const baseQuery = `
    SELECT l.*,
           COALESCE(c.name, l.company_name) AS company_name
      FROM leads l
      LEFT JOIN companies c ON c.id = l.company_id
     WHERE l.is_deleted = FALSE AND l.tenant_id = $1`

  const result = isAdmin
    ? await query(baseQuery + ' ORDER BY l.updated_at DESC', [tenantId])
    : await query(baseQuery + ' AND l.owner_id = $2 ORDER BY l.updated_at DESC', [tenantId, userId])
  return result.rows.map(mapLead)
}

export async function findLeadById(id: string, tenantId: string) {
  const result = await query(
    `SELECT l.*,
            COALESCE(c.name, l.company_name) AS company_name
       FROM leads l
       LEFT JOIN companies c ON c.id = l.company_id
      WHERE l.id = $1 AND l.tenant_id = $2`,
    [id, tenantId]
  )
  return result.rows[0] ? mapLead(result.rows[0]) : null
}
```

Do the same for `findDeletedLeads` (same JOIN pattern, same COALESCE).

- [ ] **Step 3: Update `createLead` to accept `companyId`**

Add `companyId?: string | null` to the createLead data type:

```typescript
export async function createLead(data: {
  companyName:      string;
  companyId?:       string | null;   // ADD
  solution:         string;
  // ... rest unchanged
}) {
  const result = await query(
    `INSERT INTO leads
       (company_name, company_id, solution, contacts, sales_stage, image_count, box_count,
        estimated_revenue, probability, remarks, ho_update, position,
        owner_id, owner_email, tenant_id, custom_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      data.companyName, data.companyId ?? null, data.solution,
      JSON.stringify(data.contacts),
      data.salesStage, data.imageCount, data.boxCount,
      data.estimatedRevenue, data.probability, data.remarks, data.hoUpdate,
      data.position, data.ownerId, data.ownerEmail,
      data.tenantId, JSON.stringify(data.customFields ?? {}),
    ]
  )
  return mapLead(result.rows[0])
}
```

- [ ] **Step 4: Update `updateLead` to accept `companyId`**

Add `companyId?: string | null` to the update data type:

```typescript
export async function updateLead(id: string, tenantId: string, data: {
  companyName?:      string;
  companyId?:        string | null;  // ADD
  // ... rest unchanged
}) {
  const result = await query(
    `UPDATE leads SET
       company_name      = COALESCE($1,  company_name),
       company_id        = COALESCE($2,  company_id),    -- ADD THIS LINE
       solution          = COALESCE($3,  solution),
       contacts          = COALESCE($4,  contacts),
       sales_stage       = COALESCE($5,  sales_stage),
       image_count       = COALESCE($6,  image_count),
       box_count         = COALESCE($7,  box_count),
       estimated_revenue = COALESCE($8,  estimated_revenue),
       probability       = COALESCE($9,  probability),
       remarks           = COALESCE($10, remarks),
       ho_update         = COALESCE($11, ho_update),
       position          = COALESCE($12, position),
       owner_id          = COALESCE($13, owner_id),
       owner_email       = COALESCE($14, owner_email),
       custom_fields     = COALESCE($15, custom_fields)
     WHERE id = $16 AND tenant_id = $17
     RETURNING *`,
    [
      data.companyName, data.companyId ?? undefined,   // $1, $2
      data.solution,
      data.contacts !== undefined ? JSON.stringify(data.contacts) : null,
      data.salesStage, data.imageCount, data.boxCount,
      data.estimatedRevenue, data.probability, data.remarks, data.hoUpdate,
      data.position, data.ownerId, data.ownerEmail,
      data.customFields !== undefined ? JSON.stringify(data.customFields) : null,
      id, tenantId,
    ]
  )
  return result.rows[0] ? mapLead(result.rows[0]) : null
}
```

> **Parameter shift note:** Adding `company_id` at `$2` shifts all existing params up by one. Re-number carefully: `$3` through `$17`.

- [ ] **Step 5: Update `createLeadHandler` in `leadController.ts`**

Extract `companyId` from `req.body` and pass to `createLead`:

```typescript
const { companyName, companyId, solution, ... } = req.body
// ...
const lead = await createLead({
  companyName, companyId: companyId ?? null, solution, ...
})
```

- [ ] **Step 6: Update `updateLeadHandler` in `leadController.ts`**

Same — extract `companyId` and pass to `updateLead`:
```typescript
const { companyName, companyId, solution, ... } = req.body
// ...
await updateLead(id, tenantId, { companyName, companyId, solution, ... })
```

- [ ] **Step 7: Verify TypeScript**

```powershell
cd "D:\Project\Sale Funnel\backend"; npx tsc --noEmit
```

Fix any parameter count mismatches in the SQL query.

- [ ] **Step 8: Commit**

```powershell
cd "D:\Project\Sale Funnel"
git add backend/src/models/leadModel.ts backend/src/controllers/leadController.ts
git commit -m "feat(leads): add companyId FK to lead model, JOIN company name on queries"
```

---

## Task 5: Frontend Types + Services

**Files:**
- Modify: `frontend/src/models/index.ts`
- Create: `frontend/src/services/companyService.ts`
- Create: `frontend/src/services/contactService.ts`

- [ ] **Step 1: Add Company and Contact types to `frontend/src/models/index.ts`**

Read the file, then add at the end:

```typescript
export interface Company {
  id:        string
  tenantId:  string
  name:      string
  website:   string | null
  phone:     string | null
  address:   string | null
  notes:     string | null
  leadCount?: number
  contacts?: ContactRecord[]
  createdAt: string
  updatedAt: string
}

export interface ContactRecord {
  id:          string
  tenantId:    string
  companyId:   string | null
  name:        string
  phone:       string | null
  email:       string | null
  designation: string | null
  createdAt:   string
  updatedAt:   string
}
```

Also add `companyId?: string | null` to the existing `Lead` interface.

- [ ] **Step 2: Create `frontend/src/services/companyService.ts`**

Check how `apiFetch` is imported in `leadService.ts` first. Use the same import path.

```typescript
import { apiFetch } from './apiClient'
import type { Company } from '@/models'

export const getCompanies = () =>
  apiFetch<Company[]>('/api/companies')

export const getCompany = (id: string) =>
  apiFetch<Company>(`/api/companies/${id}`)

export const createCompany = (data: {
  name: string; website?: string; phone?: string; address?: string; notes?: string
}) => apiFetch<Company>('/api/companies', { method: 'POST', body: JSON.stringify(data) })

export const updateCompany = (id: string, data: Partial<{
  name: string; website: string | null; phone: string | null; address: string | null; notes: string | null
}>) => apiFetch<Company>(`/api/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteCompany = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/companies/${id}`, { method: 'DELETE' })
```

- [ ] **Step 3: Create `frontend/src/services/contactService.ts`**

```typescript
import { apiFetch } from './apiClient'
import type { ContactRecord } from '@/models'

export const getContactsByCompany = (companyId: string) =>
  apiFetch<ContactRecord[]>(`/api/contacts?companyId=${encodeURIComponent(companyId)}`)

export const createContact = (data: {
  companyId?: string; name: string; phone?: string; email?: string; designation?: string
}) => apiFetch<ContactRecord>('/api/contacts', { method: 'POST', body: JSON.stringify(data) })

export const updateContact = (id: string, data: Partial<{
  name: string; phone: string | null; email: string | null; designation: string | null
}>) => apiFetch<ContactRecord>(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteContact = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/contacts/${id}`, { method: 'DELETE' })
```

- [ ] **Step 4: Verify TypeScript**

```powershell
cd "D:\Project\Sale Funnel\frontend"; npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```powershell
cd "D:\Project\Sale Funnel"
git add frontend/src/models/index.ts frontend/src/services/companyService.ts frontend/src/services/contactService.ts
git commit -m "feat(companies): add Company/Contact types and frontend services"
```

---

## Task 6: Companies Page

**Files:**
- Create: `frontend/src/pages/shared/CompaniesPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Read Sidebar.tsx and App.tsx**

Read both files to understand the nav link pattern and route registration pattern. Follow the exact same pattern as `LeadsPage` and `/leads` route.

- [ ] **Step 2: Create `frontend/src/pages/shared/CompaniesPage.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { Building2, Plus, Search, Trash2, Edit, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { getCompanies, createCompany, updateCompany, deleteCompany } from '@/services/companyService'
import type { Company } from '@/models'

export function CompaniesPage() {
  const [companies, setCompanies]       = useState<Company[]>([])
  const [search, setSearch]             = useState('')
  const [isLoading, setIsLoading]       = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [editTarget, setEditTarget]     = useState<Company | null>(null)
  const [form, setForm]                 = useState({ name: '', website: '', phone: '', address: '', notes: '' })
  const [saving, setSaving]             = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)

  useEffect(() => {
    void getCompanies()
      .then(setCompanies)
      .catch(() => toast.error('Failed to load companies'))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => {
    setEditTarget(null)
    setForm({ name: '', website: '', phone: '', address: '', notes: '' })
    setShowForm(true)
  }

  const openEdit = (c: Company) => {
    setEditTarget(c)
    setForm({ name: c.name, website: c.website ?? '', phone: c.phone ?? '', address: c.address ?? '', notes: c.notes ?? '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Company name is required'); return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateCompany(editTarget.id, {
          name: form.name.trim(),
          website: form.website || null,
          phone: form.phone || null,
          address: form.address || null,
          notes: form.notes || null,
        })
        setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c))
        toast.success('Company updated')
      } else {
        const created = await createCompany({
          name: form.name.trim(),
          website: form.website || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        })
        setCompanies(prev => [...prev, created])
        toast.success('Company created')
      }
      setShowForm(false)
    } catch {
      toast.error('Failed to save company')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteCompany(deleteTarget.id)
      setCompanies(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success('Company deleted')
    } catch {
      toast.error('Failed to delete company')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-muted-foreground text-sm">{companies.length} total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Company
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies…"
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Companies grid */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{search ? 'No companies match your search' : 'No companies yet — add one to get started'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(company => (
            <div key={company.id} className="bg-card border rounded-lg p-4 space-y-2 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium truncate">{company.name}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(company)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(company)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {company.phone && <p className="text-sm text-muted-foreground">{company.phone}</p>}
              {company.website && (
                <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                   target="_blank" rel="noopener noreferrer"
                   className="text-xs text-primary flex items-center gap-1 hover:underline"
                   onClick={e => e.stopPropagation()}>
                  <ExternalLink className="h-3 w-3" />
                  {company.website}
                </a>
              )}
              <p className="text-xs text-muted-foreground">
                {company.leadCount ?? 0} deal{(company.leadCount ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Company' : 'New Company'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+94 11 234 5678" />
            </div>
            <div>
              <label className="text-sm font-medium">Website</label>
              <Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="acme.com" />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the company record. Linked deals will keep their company name but lose the company reference.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Add route in `App.tsx`**

Read `App.tsx`. Find where `/leads` route is defined. Add alongside it:
```tsx
import { CompaniesPage } from '@/pages/shared/CompaniesPage'
// ...
<Route path="/companies" element={<CompaniesPage />} />
```

- [ ] **Step 4: Add sidebar nav link**

Read `Sidebar.tsx`. Find the nav links section. Add a Companies link alongside Leads:
```tsx
import { Building2 } from 'lucide-react'
// ...
{ to: '/companies', icon: Building2, label: 'Companies' },
```

Follow the exact same pattern used by other nav links in the file.

- [ ] **Step 5: Verify TypeScript**

```powershell
cd "D:\Project\Sale Funnel\frontend"; npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```powershell
cd "D:\Project\Sale Funnel"
git add frontend/src/pages/shared/CompaniesPage.tsx frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat(companies): add Companies page with CRUD UI"
```

---

## Task 7: Contacts Page

**Files:**
- Create: `frontend/src/pages/shared/ContactsPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create `frontend/src/pages/shared/ContactsPage.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { User, Plus, Search, Trash2, Edit, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getCompanies } from '@/services/companyService'
import { createContact, updateContact, deleteContact } from '@/services/contactService'
import { apiFetch } from '@/services/apiClient'
import type { Company, ContactRecord } from '@/models'

export function ContactsPage() {
  const [contacts,     setContacts]     = useState<ContactRecord[]>([])
  const [companies,    setCompanies]    = useState<Company[]>([])
  const [search,       setSearch]       = useState('')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [isLoading,    setIsLoading]    = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [editTarget,   setEditTarget]   = useState<ContactRecord | null>(null)
  const [form,         setForm]         = useState({ name: '', phone: '', email: '', designation: '', companyId: '' })
  const [saving,       setSaving]       = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ContactRecord | null>(null)

  useEffect(() => {
    void Promise.all([
      apiFetch<ContactRecord[]>('/api/contacts?companyId='),
      getCompanies(),
    ]).then(([c, co]) => {
      setContacts(c)
      setCompanies(co)
    }).catch(() => toast.error('Failed to load contacts'))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = contacts.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesCompany = companyFilter === 'all' || c.companyId === companyFilter
    return matchesSearch && matchesCompany
  })

  const getCompanyName = (id: string | null) =>
    id ? (companies.find(c => c.id === id)?.name ?? '—') : '—'

  const openCreate = () => {
    setEditTarget(null)
    setForm({ name: '', phone: '', email: '', designation: '', companyId: '' })
    setShowForm(true)
  }

  const openEdit = (c: ContactRecord) => {
    setEditTarget(c)
    setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', designation: c.designation ?? '', companyId: c.companyId ?? '' })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Contact name is required'); return }
    setSaving(true)
    try {
      if (editTarget) {
        const updated = await updateContact(editTarget.id, {
          name: form.name.trim(),
          phone: form.phone || null,
          email: form.email || null,
          designation: form.designation || null,
        })
        setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
        toast.success('Contact updated')
      } else {
        const created = await createContact({
          name: form.name.trim(),
          companyId: form.companyId || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          designation: form.designation || undefined,
        })
        setContacts(prev => [...prev, created])
        toast.success('Contact created')
      }
      setShowForm(false)
    } catch {
      toast.error('Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteContact(deleteTarget.id)
      setContacts(prev => prev.filter(c => c.id !== deleteTarget.id))
      toast.success('Contact deleted')
    } catch {
      toast.error('Failed to delete contact')
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm">{contacts.length} total</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search contacts…" className="pl-9 w-56" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-44">
            <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contacts list */}
      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{search || companyFilter !== 'all' ? 'No contacts match your filters' : 'No contacts yet'}</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(contact => (
            <div key={contact.id} className="bg-card border rounded-lg p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{contact.name}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(contact)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(contact)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {contact.designation && <p className="text-xs text-muted-foreground">{contact.designation}</p>}
              {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
              {contact.phone && <p className="text-xs text-muted-foreground">{contact.phone}</p>}
              <p className="text-xs text-primary/70 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {getCompanyName(contact.companyId)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit Contact' : 'New Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-sm font-medium">Company</label>
              <Select value={form.companyId} onValueChange={v => setForm(f => ({ ...f, companyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— No company —</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Designation</label>
              <Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} placeholder="Sales Manager" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@acme.com" />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+94 71 234 5678" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This contact will be removed permanently.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

> **Note:** The `GET /api/contacts?companyId=` with empty companyId will return ALL contacts for the tenant. Verify the backend route handles empty string query param correctly — if it doesn't (e.g. `findContactsByCompany('')` would fail), add a dedicated `GET /api/contacts` route to the contacts router that calls a `findAllContacts(tenantId)` function in contactModel.

- [ ] **Step 2: Add route in App.tsx**

```tsx
import { ContactsPage } from '@/pages/shared/ContactsPage'
// ...
<Route path="/contacts" element={<ContactsPage />} />
```

- [ ] **Step 3: Add sidebar link**

```tsx
import { Users } from 'lucide-react'
// ...
{ to: '/contacts', icon: Users, label: 'Contacts' },
```

- [ ] **Step 4: Add `findAllContacts` to contactModel.ts**

In `backend/src/models/contactModel.ts`, add:
```typescript
export async function findAllContacts(tenantId: string): Promise<Contact[]> {
  const result = await query(
    'SELECT * FROM contacts WHERE tenant_id = $1 ORDER BY name ASC',
    [tenantId]
  )
  return result.rows.map(mapRow)
}
```

- [ ] **Step 5: Update contacts route to handle `GET /` without companyId**

In `backend/src/routes/contacts.ts`, update the GET handler:
```typescript
import { listContactsByCompany, listAllContacts, createContactHandler, updateContactHandler, deleteContactHandler } from '../controllers/contactController'

router.get('/', requireAuth, (req, res) => {
  if (req.query.companyId && typeof req.query.companyId === 'string' && req.query.companyId !== '') {
    req.params.companyId = req.query.companyId
    return listContactsByCompany(req, res)
  }
  return listAllContacts(req, res)
})
```

Add `listAllContacts` to `contactController.ts`:
```typescript
import { findAllContacts, findContactsByCompany, ... } from '../models/contactModel'

export async function listAllContacts(req: Request, res: Response) {
  try {
    const contacts = await findAllContacts(req.user!.tenantId)
    res.json(contacts)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

- [ ] **Step 6: Verify TypeScript (both)**

```powershell
cd "D:\Project\Sale Funnel\backend"; npx tsc --noEmit
cd "D:\Project\Sale Funnel\frontend"; npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```powershell
cd "D:\Project\Sale Funnel"
git add frontend/src/pages/shared/ContactsPage.tsx frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx backend/src/models/contactModel.ts backend/src/controllers/contactController.ts backend/src/routes/contacts.ts
git commit -m "feat(contacts): add Contacts page with CRUD UI and GET all contacts endpoint"
```

---

## Task 8: CompanyPicker + Update LeadForm

**Files:**
- Create: `frontend/src/components/leads/CompanyPicker.tsx`
- Modify: `frontend/src/components/leads/LeadForm.tsx`

- [ ] **Step 1: Create `frontend/src/components/leads/CompanyPicker.tsx`**

A combobox that searches existing companies and lets you create a new one inline.

```tsx
import { useState, useEffect, useRef } from 'react'
import { Building2, Plus, Check, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import { getCompanies, createCompany } from '@/services/companyService'
import type { Company } from '@/models'

interface CompanyPickerProps {
  value:    string        // companyId or ''
  onChange: (companyId: string, companyName: string) => void
  required?: boolean
}

export function CompanyPicker({ value, onChange, required }: CompanyPickerProps) {
  const [open,      setOpen]      = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [search,    setSearch]    = useState('')
  const [creating,  setCreating]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void getCompanies().then(setCompanies).catch(() => {})
  }, [])

  const selected = companies.find(c => c.id === value)

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (company: Company) => {
    onChange(company.id, company.name)
    setOpen(false)
    setSearch('')
  }

  const handleCreateNew = async () => {
    const name = search.trim()
    if (!name) return
    setCreating(true)
    try {
      const created = await createCompany({ name })
      setCompanies(prev => [...prev, created])
      onChange(created.id, created.name)
      setOpen(false)
      setSearch('')
    } catch {
      // silently ignore — user can try again
    } finally {
      setCreating(false)
    }
  }

  const noMatch = search.trim() !== '' && filtered.length === 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground')}
        >
          <span className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            {selected ? selected.name : (required ? 'Select company *' : 'Select company…')}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          ref={inputRef}
          placeholder="Search or type to create…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && noMatch) void handleCreateNew() }}
          className="mb-2 h-8 text-sm"
          autoFocus
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {filtered.map(company => (
            <button
              key={company.id}
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
              onClick={() => handleSelect(company)}
            >
              <Check className={cn('h-3.5 w-3.5', company.id === value ? 'opacity-100' : 'opacity-0')} />
              {company.name}
              <span className="ml-auto text-xs text-muted-foreground">{company.leadCount ?? 0} deals</span>
            </button>
          ))}
          {noMatch && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left text-primary"
              onClick={handleCreateNew}
              disabled={creating}
            >
              <Plus className="h-3.5 w-3.5" />
              {creating ? 'Creating…' : `Create "${search.trim()}"`}
            </button>
          )}
          {companies.length === 0 && !search && (
            <p className="text-xs text-muted-foreground px-2 py-1.5">No companies yet — type to create one</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

> **Check Popover availability:** Verify `frontend/src/components/ui/popover.tsx` exists. If not, check how the project does dropdown-style overlays — may need to use `DropdownMenu` or a custom `div` with portal instead.

- [ ] **Step 2: Update `LeadForm.tsx` to use CompanyPicker**

Read the full file first. Then:

1. Add import: `import { CompanyPicker } from './CompanyPicker'`
2. Add `companyId` state alongside existing form state:
   ```typescript
   const [companyId, setCompanyId] = useState<string>(initialData?.companyId ?? '')
   ```
3. Replace the `companyName` text input with `CompanyPicker`:
   ```tsx
   {/* Replace: <Input value={companyName} ... /> */}
   <CompanyPicker
     value={companyId}
     onChange={(id, name) => {
       setCompanyId(id)
       setCompanyName(name)
     }}
     required
   />
   ```
4. Include `companyId` in the `onSave` call:
   ```typescript
   onSave({ ..., companyName, companyId: companyId || undefined, ... })
   ```
5. Update the `LeadFormData` type (or the `onSave` prop type) to accept `companyId?: string`

> **Keep companyName:** Don't remove `companyName` from form state — it's still needed as a fallback for display and for the API. The CompanyPicker sets BOTH `companyId` and `companyName` when a selection is made.

- [ ] **Step 3: Verify TypeScript**

```powershell
cd "D:\Project\Sale Funnel\frontend"; npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
cd "D:\Project\Sale Funnel"
git add frontend/src/components/leads/CompanyPicker.tsx frontend/src/components/leads/LeadForm.tsx
git commit -m "feat(leads): replace companyName text input with CompanyPicker combobox"
```

---

## Self-Review

**Spec coverage:**
- ✅ Companies table + CRUD
- ✅ Contacts table + CRUD  
- ✅ `company_id` FK on leads
- ✅ Data migration from existing leads
- ✅ Companies page
- ✅ Contacts page
- ✅ Lead form uses company picker
- ✅ `findContactsByCompany` used in `GET /api/companies/:id`
- ✅ Non-breaking: `company_name` preserved via COALESCE JOIN

**Type consistency check:**
- `Company` interface used in `companyModel.ts`, `companyController.ts`, `companyService.ts`, `CompaniesPage.tsx` — all same shape ✅
- `ContactRecord` (frontend) / `Contact` (backend) — different names by design (avoid conflict with browser `Contact` API) ✅
- `companyId` added to both backend `createLead`/`updateLead` and frontend `LeadFormData` ✅

**Migration note:** The contacts data migration uses `ON CONFLICT (id) DO NOTHING` — this requires the JSONB contact IDs to be valid UUIDs. The frontend assigns UUIDs via `crypto.randomUUID()` when contacts are created in the form. If any non-UUID IDs exist in the JSONB, the `gen_random_uuid()` fallback in `COALESCE((elem->>'id')::uuid, gen_random_uuid())` handles it.
