# Lead Feed API — Implementation Plan (Part 1: Inbound Webhook + Review Queue)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow external systems (website forms, Zapier, any HTTP client) to push leads into DOK CRM via a webhook URL or API key, with all incoming leads landing in an admin review queue before entering the pipeline.

**Architecture:** Three new DB tables (`integrations`, `incoming_leads`, `integration_logs`) hold connection config and the queue. A public `/api/inbound/:apiKey` endpoint accepts POST requests, runs smart field mapping, checks for duplicates, and writes to `incoming_leads`. Admins review from a new "Incoming Leads" page and approve/reject leads into the pipeline.

**Tech Stack:** Express + PostgreSQL (backend), React 18 + TypeScript + Vite (frontend), existing `apiFetch` / `query` / `createNotification` patterns.

---

## File Map

**Create (backend):**
- `backend/migrations/018_integrations.sql`
- `backend/src/lib/fieldMapper.ts`
- `backend/src/models/integrationModel.ts`
- `backend/src/models/incomingLeadModel.ts`
- `backend/src/models/integrationLogModel.ts`
- `backend/src/controllers/integrationController.ts`
- `backend/src/controllers/incomingLeadController.ts`
- `backend/src/controllers/inboundWebhookController.ts`
- `backend/src/routes/integrations.ts`
- `backend/src/routes/incomingLeads.ts`
- `backend/src/routes/inbound.ts`

**Modify (backend):**
- `backend/src/routes/index.ts` — register 3 new routers
- `backend/src/services/notificationService.ts` — add `notifyIncomingLeads`
- `backend/migrations/013_notifications.sql` — document only (constraint updated in 018)

**Create (frontend):**
- `frontend/src/services/integrationService.ts`
- `frontend/src/services/incomingLeadService.ts`
- `frontend/src/pages/admin/IncomingLeadsPage.tsx`
- `frontend/src/components/settings/IntegrationSettings.tsx`
- `frontend/src/components/integrations/AddIntegrationModal.tsx`
- `frontend/src/components/integrations/WebhookSetupPanel.tsx`

**Modify (frontend):**
- `frontend/src/pages/admin/WorkspaceSettings.tsx` — add Integrations tab
- `frontend/src/components/layout/Sidebar.tsx` — add Incoming Leads nav item
- `frontend/src/App.tsx` — add `/incoming-leads` route

---

## Task 1: Database migration

**Files:**
- Create: `backend/migrations/018_integrations.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/migrations/018_integrations.sql

-- ── integrations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  type           TEXT        NOT NULL CHECK (type IN ('inbound_webhook', 'facebook_lead_ads', 'http_poll')),
  config         JSONB       NOT NULL DEFAULT '{}',
  api_key        TEXT        NOT NULL UNIQUE,
  is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant_id ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integrations_api_key   ON integrations(api_key);

-- ── incoming_leads ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incoming_leads (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID        NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  raw_data       JSONB       NOT NULL,
  mapped_data    JSONB       NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected')),
  duplicate_of   UUID        REFERENCES leads(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    UUID        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_incoming_leads_tenant_id      ON incoming_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incoming_leads_integration_id ON incoming_leads(integration_id);
CREATE INDEX IF NOT EXISTS idx_incoming_leads_status         ON incoming_leads(status);

-- ── integration_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integration_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID        NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_at         TIMESTAMPTZ DEFAULT NOW(),
  status         TEXT        NOT NULL CHECK (status IN ('success', 'error')),
  leads_fetched  INTEGER     NOT NULL DEFAULT 0,
  leads_created  INTEGER     NOT NULL DEFAULT 0,
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON integration_logs(integration_id);

-- ── add incoming_leads to notifications type constraint ───────────────────────
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'lead_assigned', 'lead_stage_changed', 'task_assigned',
      'task_due_today', 'task_overdue', 'lead_expiry_reminder',
      'trial_expiry_warning', 'trial_expired', 'incoming_leads'
    )
  );
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npm run migrate
```

Expected output:
```
Running 1 pending migration(s)...
  ▶ 018_integrations.sql
  ✅ Done

All migrations complete.
```

- [ ] **Step 3: Verify tables exist**

```bash
docker compose exec postgres psql -U dokcrm -d dokcrm -c "\dt integrations incoming_leads integration_logs"
```

Expected: 3 rows listed.

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/018_integrations.sql
git commit -m "feat(db): add integrations, incoming_leads, integration_logs tables"
```

---

## Task 2: Smart field mapper utility

**Files:**
- Create: `backend/src/lib/fieldMapper.ts`

- [ ] **Step 1: Create the file**

```typescript
// backend/src/lib/fieldMapper.ts

const FIELD_MAP: Record<string, string> = {
  name:           'contact_name',
  full_name:      'contact_name',
  contact_name:   'contact_name',
  contact:        'contact_name',
  first_name:     'contact_name',
  company:        'company_name',
  company_name:   'company_name',
  business:       'company_name',
  org:            'company_name',
  organisation:   'company_name',
  organization:   'company_name',
  email:          'email',
  email_address:  'email',
  phone:          'phone',
  phone_number:   'phone',
  mobile:         'phone',
  tel:            'phone',
  value:          'value',
  deal_value:     'value',
  amount:         'value',
  budget:         'value',
  notes:          'remarks',
  message:        'remarks',
  description:    'remarks',
  remarks:        'remarks',
}

export function mapFields(raw: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}
  const custom: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(raw)) {
    if (val === null || val === undefined || val === '') continue
    const normalised = key.toLowerCase().replace(/[\s\-]/g, '_')
    const crmField = FIELD_MAP[normalised]
    if (crmField) {
      // Don't overwrite an already-mapped field (first match wins)
      if (mapped[crmField] === undefined) mapped[crmField] = val
    } else {
      custom[key] = val
    }
  }

  if (Object.keys(custom).length > 0) {
    mapped.custom_fields = custom
  }

  return mapped
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/fieldMapper.ts
git commit -m "feat(lib): add smart field mapper for incoming leads"
```

---

## Task 3: Integration model

**Files:**
- Create: `backend/src/models/integrationModel.ts`

- [ ] **Step 1: Create the file**

```typescript
// backend/src/models/integrationModel.ts
import crypto from 'crypto'
import { query } from '../config/db'

export interface Integration {
  id:            string
  tenantId:      string
  name:          string
  type:          'inbound_webhook' | 'facebook_lead_ads' | 'http_poll'
  config:        Record<string, unknown>
  apiKey:        string
  isActive:      boolean
  lastSyncedAt:  string | null
  createdAt:     string
}

const mapRow = (r: Record<string, unknown>): Integration => ({
  id:           r.id            as string,
  tenantId:     r.tenant_id     as string,
  name:         r.name          as string,
  type:         r.type          as Integration['type'],
  config:       (r.config       as Record<string, unknown>) ?? {},
  apiKey:       r.api_key       as string,
  isActive:     r.is_active     as boolean,
  lastSyncedAt: (r.last_synced_at as string | null) ?? null,
  createdAt:    r.created_at    as string,
})

export function generateApiKey(): string {
  return 'dok_live_' + crypto.randomBytes(24).toString('hex')
}

export async function findIntegrationsByTenant(tenantId: string): Promise<Integration[]> {
  const result = await query(
    'SELECT * FROM integrations WHERE tenant_id = $1 ORDER BY created_at ASC',
    [tenantId]
  )
  return result.rows.map(mapRow)
}

export async function findIntegrationByApiKey(apiKey: string): Promise<Integration | null> {
  const result = await query(
    'SELECT * FROM integrations WHERE api_key = $1',
    [apiKey]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function findIntegrationById(id: string, tenantId: string): Promise<Integration | null> {
  const result = await query(
    'SELECT * FROM integrations WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function createIntegration(tenantId: string, data: {
  name:   string
  type:   Integration['type']
  config: Record<string, unknown>
}): Promise<Integration> {
  const apiKey = generateApiKey()
  const result = await query(
    `INSERT INTO integrations (tenant_id, name, type, config, api_key)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tenantId, data.name, data.type, JSON.stringify(data.config), apiKey]
  )
  return mapRow(result.rows[0])
}

export async function updateIntegration(id: string, tenantId: string, data: {
  name?:     string
  config?:   Record<string, unknown>
  isActive?: boolean
}): Promise<Integration | null> {
  const result = await query(
    `UPDATE integrations
        SET name      = COALESCE($3, name),
            config    = COALESCE($4::jsonb, config),
            is_active = COALESCE($5, is_active)
      WHERE id = $1 AND tenant_id = $2
      RETURNING *`,
    [
      id, tenantId,
      data.name ?? null,
      data.config != null ? JSON.stringify(data.config) : null,
      data.isActive ?? null,
    ]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function regenerateApiKey(id: string, tenantId: string): Promise<string | null> {
  const newKey = generateApiKey()
  const result = await query(
    `UPDATE integrations SET api_key = $3
      WHERE id = $1 AND tenant_id = $2
      RETURNING api_key`,
    [id, tenantId, newKey]
  )
  return result.rows[0]?.api_key ?? null
}

export async function deleteIntegration(id: string, tenantId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM integrations WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function updateLastSynced(id: string): Promise<void> {
  await query(
    'UPDATE integrations SET last_synced_at = NOW() WHERE id = $1',
    [id]
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/integrationModel.ts
git commit -m "feat(models): add integrationModel"
```

---

## Task 4: Incoming lead model

**Files:**
- Create: `backend/src/models/incomingLeadModel.ts`

- [ ] **Step 1: Create the file**

```typescript
// backend/src/models/incomingLeadModel.ts
import { query } from '../config/db'

export interface IncomingLead {
  id:              string
  tenantId:        string
  integrationId:   string
  integrationName: string
  rawData:         Record<string, unknown>
  mappedData:      Record<string, unknown>
  status:          'pending' | 'approved' | 'rejected'
  duplicateOf:     string | null
  duplicateName:   string | null
  createdAt:       string
  reviewedAt:      string | null
  reviewedBy:      string | null
}

const mapRow = (r: Record<string, unknown>): IncomingLead => ({
  id:              r.id               as string,
  tenantId:        r.tenant_id        as string,
  integrationId:   r.integration_id   as string,
  integrationName: (r.integration_name as string) ?? '',
  rawData:         (r.raw_data         as Record<string, unknown>) ?? {},
  mappedData:      (r.mapped_data      as Record<string, unknown>) ?? {},
  status:          r.status            as IncomingLead['status'],
  duplicateOf:     (r.duplicate_of     as string | null) ?? null,
  duplicateName:   (r.duplicate_name   as string | null) ?? null,
  createdAt:       r.created_at        as string,
  reviewedAt:      (r.reviewed_at      as string | null) ?? null,
  reviewedBy:      (r.reviewed_by      as string | null) ?? null,
})

export async function createIncomingLead(data: {
  tenantId:      string
  integrationId: string
  rawData:       Record<string, unknown>
  mappedData:    Record<string, unknown>
  duplicateOf:   string | null
}): Promise<IncomingLead> {
  const result = await query(
    `INSERT INTO incoming_leads (tenant_id, integration_id, raw_data, mapped_data, duplicate_of)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.tenantId,
      data.integrationId,
      JSON.stringify(data.rawData),
      JSON.stringify(data.mappedData),
      data.duplicateOf,
    ]
  )
  const row = result.rows[0]
  return { ...mapRow(row), integrationName: '' }
}

export async function findIncomingLeads(
  tenantId: string,
  status?: 'pending' | 'approved' | 'rejected'
): Promise<IncomingLead[]> {
  const result = await query(
    `SELECT il.*,
            i.name  AS integration_name,
            l.company_name AS duplicate_name
       FROM incoming_leads il
       JOIN integrations i ON i.id = il.integration_id
  LEFT JOIN leads l ON l.id = il.duplicate_of
      WHERE il.tenant_id = $1
        AND ($2::text IS NULL OR il.status = $2)
      ORDER BY il.created_at DESC`,
    [tenantId, status ?? null]
  )
  return result.rows.map(mapRow)
}

export async function findIncomingLeadById(id: string, tenantId: string): Promise<IncomingLead | null> {
  const result = await query(
    `SELECT il.*,
            i.name AS integration_name,
            l.company_name AS duplicate_name
       FROM incoming_leads il
       JOIN integrations i ON i.id = il.integration_id
  LEFT JOIN leads l ON l.id = il.duplicate_of
      WHERE il.id = $1 AND il.tenant_id = $2`,
    [id, tenantId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function updateIncomingLeadMappedData(
  id: string,
  tenantId: string,
  mappedData: Record<string, unknown>
): Promise<IncomingLead | null> {
  const result = await query(
    `UPDATE incoming_leads
        SET mapped_data = $3
      WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
      RETURNING *`,
    [id, tenantId, JSON.stringify(mappedData)]
  )
  return result.rows[0] ? { ...mapRow(result.rows[0]), integrationName: '' } : null
}

/** Approve: creates a real lead from mappedData, marks incoming_lead as approved */
export async function approveIncomingLead(
  id: string,
  tenantId: string,
  reviewedBy: string,
  assignedTo: string
): Promise<string | null> {
  const incoming = await findIncomingLeadById(id, tenantId)
  if (!incoming || incoming.status !== 'pending') return null

  const d = incoming.mappedData as Record<string, unknown>

  // Create the real lead
  const leadResult = await query(
    `INSERT INTO leads
       (tenant_id, company_name, contact_name, email, phone, value,
        remarks, sales_stage, owner_id, probability, custom_fields)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'New', $8, 0, $9)
     RETURNING id`,
    [
      tenantId,
      (d.company_name as string) ?? 'Unknown',
      (d.contact_name as string) ?? null,
      (d.email        as string) ?? null,
      (d.phone        as string) ?? null,
      (d.value        as number) ?? null,
      (d.remarks      as string) ?? null,
      assignedTo,
      JSON.stringify((d.custom_fields as Record<string, unknown>) ?? {}),
    ]
  )
  const leadId = leadResult.rows[0].id as string

  // Mark as approved
  await query(
    `UPDATE incoming_leads
        SET status = 'approved', reviewed_at = NOW(), reviewed_by = $3
      WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId, reviewedBy]
  )

  return leadId
}

export async function rejectIncomingLead(
  id: string,
  tenantId: string,
  reviewedBy: string
): Promise<boolean> {
  const result = await query(
    `UPDATE incoming_leads
        SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $3
      WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
    [id, tenantId, reviewedBy]
  )
  return (result.rowCount ?? 0) > 0
}

/** Returns lead_id if email or phone matches an existing lead, null otherwise */
export async function findDuplicateLead(
  tenantId: string,
  mappedData: Record<string, unknown>
): Promise<string | null> {
  const email = mappedData.email as string | undefined
  const phone = mappedData.phone as string | undefined
  if (!email && !phone) return null

  const result = await query(
    `SELECT id FROM leads
      WHERE tenant_id = $1
        AND is_deleted = FALSE
        AND (
          (email IS NOT NULL AND LOWER(email) = LOWER($2))
          OR (phone IS NOT NULL AND phone = $3)
        )
      LIMIT 1`,
    [tenantId, email ?? '', phone ?? '']
  )
  return result.rows[0]?.id ?? null
}

export async function countPendingIncomingLeads(tenantId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) AS n FROM incoming_leads WHERE tenant_id = $1 AND status = 'pending'`,
    [tenantId]
  )
  return parseInt(result.rows[0].n, 10)
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/incomingLeadModel.ts
git commit -m "feat(models): add incomingLeadModel with approve/reject/duplicate detection"
```

---

## Task 5: Integration log model

**Files:**
- Create: `backend/src/models/integrationLogModel.ts`

- [ ] **Step 1: Create the file**

```typescript
// backend/src/models/integrationLogModel.ts
import { query } from '../config/db'

export interface IntegrationLog {
  id:            string
  integrationId: string
  tenantId:      string
  runAt:         string
  status:        'success' | 'error'
  leadsFetched:  number
  leadsCreated:  number
  errorMessage:  string | null
}

const mapRow = (r: Record<string, unknown>): IntegrationLog => ({
  id:            r.id             as string,
  integrationId: r.integration_id as string,
  tenantId:      r.tenant_id      as string,
  runAt:         r.run_at         as string,
  status:        r.status         as IntegrationLog['status'],
  leadsFetched:  r.leads_fetched  as number,
  leadsCreated:  r.leads_created  as number,
  errorMessage:  (r.error_message as string | null) ?? null,
})

export async function createLog(data: {
  integrationId: string
  tenantId:      string
  status:        'success' | 'error'
  leadsFetched:  number
  leadsCreated:  number
  errorMessage?: string
}): Promise<void> {
  await query(
    `INSERT INTO integration_logs
       (integration_id, tenant_id, status, leads_fetched, leads_created, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      data.integrationId,
      data.tenantId,
      data.status,
      data.leadsFetched,
      data.leadsCreated,
      data.errorMessage ?? null,
    ]
  )
}

export async function findLogsByIntegration(
  integrationId: string,
  limit = 10
): Promise<IntegrationLog[]> {
  const result = await query(
    `SELECT * FROM integration_logs
      WHERE integration_id = $1
      ORDER BY run_at DESC
      LIMIT $2`,
    [integrationId, limit]
  )
  return result.rows.map(mapRow)
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/integrationLogModel.ts
git commit -m "feat(models): add integrationLogModel"
```

---

## Task 6: Inbound webhook controller + public route

**Files:**
- Create: `backend/src/controllers/inboundWebhookController.ts`
- Create: `backend/src/routes/inbound.ts`

- [ ] **Step 1: Create the controller**

```typescript
// backend/src/controllers/inboundWebhookController.ts
import { Request, Response } from 'express'
import { mapFields } from '../lib/fieldMapper'
import { findIntegrationByApiKey } from '../models/integrationModel'
import { createIncomingLead, findDuplicateLead } from '../models/incomingLeadModel'
import { notifyIncomingLeads } from '../services/notificationService'
import { findAdminsByTenant } from '../models/userModel'

export async function receiveWebhook(req: Request, res: Response) {
  try {
    // Resolve api_key from URL param or Bearer header
    let apiKey = req.params.apiKey as string | undefined
    if (!apiKey) {
      const authHeader = req.headers.authorization as string | undefined
      if (authHeader?.startsWith('Bearer ')) {
        apiKey = authHeader.slice(7).trim()
      }
    }

    if (!apiKey) {
      res.status(401).json({ error: 'API key required' })
      return
    }

    const integration = await findIntegrationByApiKey(apiKey)
    if (!integration || !integration.isActive) {
      res.status(401).json({ error: 'Invalid or inactive API key' })
      return
    }

    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Request body must be a JSON object' })
      return
    }

    const rawData   = body as Record<string, unknown>
    const mappedData = mapFields(rawData)
    const duplicateOf = await findDuplicateLead(integration.tenantId, mappedData)

    const incoming = await createIncomingLead({
      tenantId:      integration.tenantId,
      integrationId: integration.id,
      rawData,
      mappedData,
      duplicateOf,
    })

    // Notify all admins of this tenant
    const admins = await findAdminsByTenant(integration.tenantId)
    for (const admin of admins) {
      void notifyIncomingLeads({
        tenantId:        integration.tenantId,
        userId:          admin.id as string,
        integrationName: integration.name,
        count:           1,
      })
    }

    res.status(201).json({
      id:           incoming.id,
      status:       'pending',
      duplicateOf:  incoming.duplicateOf,
    })
  } catch (err) {
    console.error('[inboundWebhook] error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

- [ ] **Step 2: Create the route**

```typescript
// backend/src/routes/inbound.ts
import { Router } from 'express'
import { receiveWebhook } from '../controllers/inboundWebhookController'

const router = Router()

// Public routes — no auth middleware (api_key is the auth)
router.post('/:apiKey', receiveWebhook)
router.post('/',        receiveWebhook)

export default router
```

- [ ] **Step 3: Verify it compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/inboundWebhookController.ts backend/src/routes/inbound.ts
git commit -m "feat(webhook): add inbound webhook controller and route"
```

---

## Task 7: Integration management controller + route

**Files:**
- Create: `backend/src/controllers/integrationController.ts`
- Create: `backend/src/routes/integrations.ts`

- [ ] **Step 1: Create the controller**

```typescript
// backend/src/controllers/integrationController.ts
import { Request, Response } from 'express'
import {
  findIntegrationsByTenant,
  findIntegrationById,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  regenerateApiKey,
} from '../models/integrationModel'
import { findLogsByIntegration } from '../models/integrationLogModel'

export async function listIntegrations(req: Request, res: Response) {
  try {
    const integrations = await findIntegrationsByTenant(req.user!.tenantId)
    // Never return api_key in list — only in create/regenerate responses
    res.json(integrations.map(({ apiKey: _key, ...rest }) => rest))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function getIntegration(req: Request, res: Response) {
  try {
    const integration = await findIntegrationById(req.params.id, req.user!.tenantId)
    if (!integration) { res.status(404).json({ error: 'Not found' }); return }
    res.json(integration)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function createIntegrationHandler(req: Request, res: Response) {
  const { name, type, config } = req.body
  if (!name || !type) {
    res.status(400).json({ error: 'name and type are required' })
    return
  }
  const ALLOWED_TYPES = ['inbound_webhook', 'facebook_lead_ads', 'http_poll']
  if (!ALLOWED_TYPES.includes(type)) {
    res.status(400).json({ error: 'Invalid integration type' })
    return
  }
  try {
    const integration = await createIntegration(req.user!.tenantId, {
      name,
      type,
      config: config ?? {},
    })
    res.status(201).json(integration) // includes apiKey — only time it's returned
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function updateIntegrationHandler(req: Request, res: Response) {
  const { name, config, isActive } = req.body
  try {
    const integration = await updateIntegration(req.params.id, req.user!.tenantId, {
      name, config, isActive,
    })
    if (!integration) { res.status(404).json({ error: 'Not found' }); return }
    res.json(integration)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function deleteIntegrationHandler(req: Request, res: Response) {
  try {
    const deleted = await deleteIntegration(req.params.id, req.user!.tenantId)
    if (!deleted) { res.status(404).json({ error: 'Not found' }); return }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function regenerateApiKeyHandler(req: Request, res: Response) {
  try {
    const newKey = await regenerateApiKey(req.params.id, req.user!.tenantId)
    if (!newKey) { res.status(404).json({ error: 'Not found' }); return }
    res.json({ apiKey: newKey })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function getLogsHandler(req: Request, res: Response) {
  try {
    const integration = await findIntegrationById(req.params.id, req.user!.tenantId)
    if (!integration) { res.status(404).json({ error: 'Not found' }); return }
    const logs = await findLogsByIntegration(req.params.id, 10)
    res.json(logs)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

- [ ] **Step 2: Create the route**

```typescript
// backend/src/routes/integrations.ts
import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth'
import {
  listIntegrations,
  getIntegration,
  createIntegrationHandler,
  updateIntegrationHandler,
  deleteIntegrationHandler,
  regenerateApiKeyHandler,
  getLogsHandler,
} from '../controllers/integrationController'

const router = Router()

router.get('/',                    requireAuth, requireAdmin, listIntegrations)
router.get('/:id',                 requireAuth, requireAdmin, getIntegration)
router.post('/',                   requireAuth, requireAdmin, createIntegrationHandler)
router.put('/:id',                 requireAuth, requireAdmin, updateIntegrationHandler)
router.delete('/:id',              requireAuth, requireAdmin, deleteIntegrationHandler)
router.post('/:id/regenerate-key', requireAuth, requireAdmin, regenerateApiKeyHandler)
router.get('/:id/logs',            requireAuth, requireAdmin, getLogsHandler)

export default router
```

- [ ] **Step 3: Verify it compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/integrationController.ts backend/src/routes/integrations.ts
git commit -m "feat(integrations): add integration management controller and routes"
```

---

## Task 8: Incoming lead controller + route

**Files:**
- Create: `backend/src/controllers/incomingLeadController.ts`
- Create: `backend/src/routes/incomingLeads.ts`

- [ ] **Step 1: Create the controller**

```typescript
// backend/src/controllers/incomingLeadController.ts
import { Request, Response } from 'express'
import {
  findIncomingLeads,
  findIncomingLeadById,
  approveIncomingLead,
  rejectIncomingLead,
  updateIncomingLeadMappedData,
  countPendingIncomingLeads,
} from '../models/incomingLeadModel'
import { findIntegrationById } from '../models/integrationModel'

export async function listIncomingLeads(req: Request, res: Response) {
  const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined
  try {
    const leads = await findIncomingLeads(req.user!.tenantId, status)
    res.json(leads)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function getPendingCount(req: Request, res: Response) {
  try {
    const count = await countPendingIncomingLeads(req.user!.tenantId)
    res.json({ count })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function approveIncomingLeadHandler(req: Request, res: Response) {
  try {
    const incoming = await findIncomingLeadById(req.params.id, req.user!.tenantId)
    if (!incoming) { res.status(404).json({ error: 'Not found' }); return }

    // Determine assignedTo: integration config.assigned_to, or fallback to current user
    const integration = await findIntegrationById(incoming.integrationId, req.user!.tenantId)
    const assignedTo = (integration?.config?.assigned_to as string) ?? req.user!.userId

    const leadId = await approveIncomingLead(
      req.params.id,
      req.user!.tenantId,
      req.user!.userId,
      assignedTo
    )
    if (!leadId) { res.status(400).json({ error: 'Lead already reviewed' }); return }
    res.json({ leadId })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function rejectIncomingLeadHandler(req: Request, res: Response) {
  try {
    const rejected = await rejectIncomingLead(req.params.id, req.user!.tenantId, req.user!.userId)
    if (!rejected) { res.status(404).json({ error: 'Not found or already reviewed' }); return }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function updateIncomingLeadHandler(req: Request, res: Response) {
  const { mappedData } = req.body
  if (!mappedData || typeof mappedData !== 'object') {
    res.status(400).json({ error: 'mappedData object required' })
    return
  }
  try {
    const lead = await updateIncomingLeadMappedData(
      req.params.id,
      req.user!.tenantId,
      mappedData
    )
    if (!lead) { res.status(404).json({ error: 'Not found or already reviewed' }); return }
    res.json(lead)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function bulkApproveHandler(req: Request, res: Response) {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids array required' })
    return
  }
  try {
    const results: { id: string; leadId: string | null; error?: string }[] = []
    for (const id of ids as string[]) {
      const incoming = await findIncomingLeadById(id, req.user!.tenantId)
      if (!incoming) { results.push({ id, leadId: null, error: 'Not found' }); continue }
      const integration = await findIntegrationById(incoming.integrationId, req.user!.tenantId)
      const assignedTo = (integration?.config?.assigned_to as string) ?? req.user!.userId
      const leadId = await approveIncomingLead(id, req.user!.tenantId, req.user!.userId, assignedTo)
      results.push({ id, leadId })
    }
    res.json({ results })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function bulkRejectHandler(req: Request, res: Response) {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids array required' })
    return
  }
  try {
    let rejected = 0
    for (const id of ids as string[]) {
      const ok = await rejectIncomingLead(id, req.user!.tenantId, req.user!.userId)
      if (ok) rejected++
    }
    res.json({ rejected })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

- [ ] **Step 2: Create the route**

```typescript
// backend/src/routes/incomingLeads.ts
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { resolveTenant } from '../middleware/tenantResolver'
import { requireAuth, requireAdmin } from '../middleware/auth'
import {
  listIncomingLeads,
  getPendingCount,
  approveIncomingLeadHandler,
  rejectIncomingLeadHandler,
  updateIncomingLeadHandler,
  bulkApproveHandler,
  bulkRejectHandler,
} from '../controllers/incomingLeadController'

const router = Router()

router.get('/',                    requireAuth, requireAdmin, listIncomingLeads)
router.get('/count',               requireAuth, listIncomingLeads) // any authed user can see count
router.get('/pending-count',       requireAuth, getPendingCount)
router.put('/:id',                 requireAuth, requireAdmin, updateIncomingLeadHandler)
router.post('/:id/approve',        requireAuth, requireAdmin, approveIncomingLeadHandler)
router.post('/:id/reject',         requireAuth, requireAdmin, rejectIncomingLeadHandler)
router.post('/bulk-approve',       requireAuth, requireAdmin, bulkApproveHandler)
router.post('/bulk-reject',        requireAuth, requireAdmin, bulkRejectHandler)

export default router
```

- [ ] **Step 3: Verify it compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/incomingLeadController.ts backend/src/routes/incomingLeads.ts
git commit -m "feat(incoming-leads): add incoming lead controller and routes"
```

---

## Task 9: Register routes + add notification helper

**Files:**
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/services/notificationService.ts`

- [ ] **Step 1: Register the 3 new routers in index.ts**

Open `backend/src/routes/index.ts`. Add at the top with the other imports:

```typescript
import inboundRoutes      from './inbound'
import integrationRoutes  from './integrations'
import incomingLeadRoutes from './incomingLeads'
```

Add at the end of the router registrations (before `export default router`):

```typescript
router.use('/inbound',        inboundRoutes)       // public — no auth
router.use('/integrations',   integrationRoutes)
router.use('/incoming-leads', incomingLeadRoutes)
```

**Important:** The `/inbound` route must NOT have `resolveTenant` middleware applied globally. Check `backend/src/index.ts` — the `/api` prefix applies all routes via `app.use('/api', apiRoutes)` which is fine since inbound.ts has no auth middleware internally.

- [ ] **Step 2: Add notifyIncomingLeads to notificationService.ts**

Open `backend/src/services/notificationService.ts` and add at the end:

```typescript
export function notifyIncomingLeads(params: {
  tenantId:        string
  userId:          string
  integrationName: string
  count:           number
}): void {
  void notify({
    tenantId: params.tenantId,
    userId:   params.userId,
    type:     'incoming_leads',
    title:    `${params.count} new lead${params.count !== 1 ? 's' : ''} waiting for review`,
    body:     `From ${params.integrationName}`,
    link:     '/incoming-leads',
  })
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd backend && npx tsc --noEmit
```

- [ ] **Step 4: Start the backend and check it boots**

```bash
cd backend && npm run dev
```

Expected: `CRM STACK Backend running on port 4000` with no errors.

- [ ] **Step 5: Test the webhook endpoint with curl**

First create an integration in the DB directly (you'll have a proper UI after Task 13):

```bash
docker compose exec postgres psql -U dokcrm -d dokcrm -c "
INSERT INTO integrations (tenant_id, name, type, config, api_key)
VALUES (
  (SELECT id FROM tenants WHERE subdomain = 'abanscrm'),
  'Test Webhook',
  'inbound_webhook',
  '{\"assigned_to\": null}',
  'dok_live_test123'
);"
```

Then send a test lead:

```bash
curl -X POST http://localhost:4000/api/inbound/dok_live_test123 \
  -H "Content-Type: application/json" \
  -d '{"company": "Acme Corp", "full_name": "John Smith", "email": "john@acme.com", "phone": "0712345678"}'
```

Expected response:
```json
{"id": "...", "status": "pending", "duplicateOf": null}
```

Verify in DB:
```bash
docker compose exec postgres psql -U dokcrm -d dokcrm -c "SELECT id, status, mapped_data FROM incoming_leads LIMIT 1;"
```

Expected: row with `status = 'pending'` and `mapped_data` containing `company_name`, `contact_name`, `email`, `phone`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/index.ts backend/src/services/notificationService.ts
git commit -m "feat: register inbound/integration/incoming-lead routes and add notification helper"
```

---

## Task 10: Frontend types + services

**Files:**
- Create: `frontend/src/services/integrationService.ts`
- Create: `frontend/src/services/incomingLeadService.ts`

- [ ] **Step 1: Create integrationService.ts**

```typescript
// frontend/src/services/integrationService.ts
import { apiFetch } from './apiClient'

export type IntegrationType = 'inbound_webhook' | 'facebook_lead_ads' | 'http_poll'

export interface Integration {
  id:            string
  tenantId:      string
  name:          string
  type:          IntegrationType
  config:        Record<string, unknown>
  isActive:      boolean
  lastSyncedAt:  string | null
  createdAt:     string
}

export interface IntegrationWithKey extends Integration {
  apiKey: string
}

export interface IntegrationLog {
  id:            string
  integrationId: string
  runAt:         string
  status:        'success' | 'error'
  leadsFetched:  number
  leadsCreated:  number
  errorMessage:  string | null
}

export const getIntegrations = () =>
  apiFetch<Integration[]>('/api/integrations')

export const getIntegration = (id: string) =>
  apiFetch<IntegrationWithKey>(`/api/integrations/${id}`)

export const createIntegration = (data: {
  name:   string
  type:   IntegrationType
  config: Record<string, unknown>
}) =>
  apiFetch<IntegrationWithKey>('/api/integrations', {
    method: 'POST',
    body:   JSON.stringify(data),
  })

export const updateIntegration = (id: string, data: {
  name?:     string
  config?:   Record<string, unknown>
  isActive?: boolean
}) =>
  apiFetch<Integration>(`/api/integrations/${id}`, {
    method: 'PUT',
    body:   JSON.stringify(data),
  })

export const deleteIntegration = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/integrations/${id}`, { method: 'DELETE' })

export const regenerateApiKey = (id: string) =>
  apiFetch<{ apiKey: string }>(`/api/integrations/${id}/regenerate-key`, { method: 'POST' })

export const getIntegrationLogs = (id: string) =>
  apiFetch<IntegrationLog[]>(`/api/integrations/${id}/logs`)
```

- [ ] **Step 2: Create incomingLeadService.ts**

```typescript
// frontend/src/services/incomingLeadService.ts
import { apiFetch } from './apiClient'

export interface IncomingLead {
  id:              string
  tenantId:        string
  integrationId:   string
  integrationName: string
  rawData:         Record<string, unknown>
  mappedData:      Record<string, unknown>
  status:          'pending' | 'approved' | 'rejected'
  duplicateOf:     string | null
  duplicateName:   string | null
  createdAt:       string
  reviewedAt:      string | null
  reviewedBy:      string | null
}

export const getIncomingLeads = (status?: string) =>
  apiFetch<IncomingLead[]>(`/api/incoming-leads${status ? `?status=${status}` : ''}`)

export const getPendingCount = () =>
  apiFetch<{ count: number }>('/api/incoming-leads/pending-count')

export const approveIncomingLead = (id: string) =>
  apiFetch<{ leadId: string }>(`/api/incoming-leads/${id}/approve`, { method: 'POST' })

export const rejectIncomingLead = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/incoming-leads/${id}/reject`, { method: 'POST' })

export const updateIncomingLead = (id: string, mappedData: Record<string, unknown>) =>
  apiFetch<IncomingLead>(`/api/incoming-leads/${id}`, {
    method: 'PUT',
    body:   JSON.stringify({ mappedData }),
  })

export const bulkApprove = (ids: string[]) =>
  apiFetch<{ results: { id: string; leadId: string | null }[] }>(
    '/api/incoming-leads/bulk-approve',
    { method: 'POST', body: JSON.stringify({ ids }) }
  )

export const bulkReject = (ids: string[]) =>
  apiFetch<{ rejected: number }>(
    '/api/incoming-leads/bulk-reject',
    { method: 'POST', body: JSON.stringify({ ids }) }
  )
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/integrationService.ts frontend/src/services/incomingLeadService.ts
git commit -m "feat(frontend): add integration and incomingLead service files"
```

---

## Task 11: IncomingLeadsPage

**Files:**
- Create: `frontend/src/pages/admin/IncomingLeadsPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
// frontend/src/pages/admin/IncomingLeadsPage.tsx
import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Button }   from '@/components/ui/button'
import { Badge }    from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getIncomingLeads,
  approveIncomingLead,
  rejectIncomingLead,
  bulkApprove,
  bulkReject,
  type IncomingLead,
} from '@/services/incomingLeadService'

type TabStatus = 'pending' | 'approved' | 'rejected' | 'all'

export function IncomingLeadsPage() {
  const [leads,     setLeads]     = useState<IncomingLead[]>([])
  const [tab,       setTab]       = useState<TabStatus>('pending')
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [acting,    setActing]    = useState<Set<string>>(new Set())

  const load = async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const data = await getIncomingLeads(tab === 'all' ? undefined : tab)
      setLeads(data)
    } catch {
      toast.error('Failed to load incoming leads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [tab])

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected(prev => prev.size === leads.length ? new Set() : new Set(leads.map(l => l.id)))

  const handleApprove = async (id: string) => {
    setActing(prev => new Set(prev).add(id))
    try {
      await approveIncomingLead(id)
      toast.success('Lead approved and added to pipeline')
      void load()
    } catch {
      toast.error('Failed to approve lead')
    } finally {
      setActing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleReject = async (id: string) => {
    setActing(prev => new Set(prev).add(id))
    try {
      await rejectIncomingLead(id)
      toast.success('Lead rejected')
      void load()
    } catch {
      toast.error('Failed to reject lead')
    } finally {
      setActing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleBulkApprove = async () => {
    const ids = Array.from(selected)
    try {
      await bulkApprove(ids)
      toast.success(`${ids.length} lead${ids.length !== 1 ? 's' : ''} approved`)
      void load()
    } catch {
      toast.error('Bulk approve failed')
    }
  }

  const handleBulkReject = async () => {
    const ids = Array.from(selected)
    try {
      await bulkReject(ids)
      toast.success(`${ids.length} lead${ids.length !== 1 ? 's' : ''} rejected`)
      void load()
    } catch {
      toast.error('Bulk reject failed')
    }
  }

  const pendingLeads = leads.filter(l => l.status === 'pending')

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incoming Leads</h1>
          <p className="text-muted-foreground text-sm">Review leads from external integrations before they enter the pipeline</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={tab} onValueChange={v => setTab(v as TabStatus)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={handleBulkApprove}>
              <CheckCircle className="h-4 w-4 mr-1" /> Approve All
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkReject}>
              <XCircle className="h-4 w-4 mr-1" /> Reject All
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading…</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {tab === 'all' ? '' : tab} leads</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tab === 'pending' && leads.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={selected.size === leads.length}
                onChange={toggleAll}
              />
              Select all
            </label>
          )}
          {leads.map(lead => {
            const d = lead.mappedData as Record<string, string>
            return (
              <div
                key={lead.id}
                className={`border rounded-lg p-4 bg-card flex items-start gap-3 ${
                  lead.duplicateOf ? 'border-yellow-400/60' : ''
                }`}
              >
                {lead.status === 'pending' && (
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                  />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{d.company_name ?? '—'}</span>
                    {d.contact_name && <span className="text-muted-foreground text-sm">· {d.contact_name}</span>}
                    <Badge variant="outline" className="text-xs">{lead.integrationName}</Badge>
                    {lead.status !== 'pending' && (
                      <Badge variant={lead.status === 'approved' ? 'default' : 'secondary'} className="text-xs capitalize">
                        {lead.status}
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground mt-0.5 space-x-3">
                    {d.email && <span>{d.email}</span>}
                    {d.phone && <span>{d.phone}</span>}
                    <span>{formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}</span>
                  </div>

                  {lead.duplicateOf && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-yellow-600 dark:text-yellow-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Possible duplicate — matches <strong>{lead.duplicateName ?? 'existing lead'}</strong>
                    </div>
                  )}
                </div>

                {lead.status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(lead.id)}
                      disabled={acting.has(lead.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(lead.id)}
                      disabled={acting.has(lead.id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/admin/IncomingLeadsPage.tsx
git commit -m "feat(frontend): add IncomingLeadsPage"
```

---

## Task 12: Integration Settings + Webhook Setup Panel

**Files:**
- Create: `frontend/src/components/integrations/WebhookSetupPanel.tsx`
- Create: `frontend/src/components/settings/IntegrationSettings.tsx`

- [ ] **Step 1: Create WebhookSetupPanel.tsx**

```tsx
// frontend/src/components/integrations/WebhookSetupPanel.tsx
import { useState } from 'react'
import { Copy, RefreshCw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input }  from '@/components/ui/input'
import { Label }  from '@/components/ui/label'
import { regenerateApiKey } from '@/services/integrationService'

interface Props {
  integrationId: string
  apiKey:        string
  onKeyRegenerated: (newKey: string) => void
}

export function WebhookSetupPanel({ integrationId, apiKey, onKeyRegenerated }: Props) {
  const [copied,       setCopied]       = useState<'url' | 'key' | null>(null)
  const [regenerating, setRegenerating] = useState(false)

  const webhookUrl = `${window.location.origin}/api/inbound/${apiKey}`

  const copy = async (text: string, type: 'url' | 'key') => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRegenerate = async () => {
    if (!confirm('Regenerate API key? The old key will stop working immediately.')) return
    setRegenerating(true)
    try {
      const { apiKey: newKey } = await regenerateApiKey(integrationId)
      onKeyRegenerated(newKey)
      toast.success('API key regenerated')
    } catch {
      toast.error('Failed to regenerate key')
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Webhook URL</Label>
        <p className="text-xs text-muted-foreground">POST JSON to this URL — no authentication header needed</p>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={() => copy(webhookUrl, 'url')}>
            {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>API Key</Label>
        <p className="text-xs text-muted-foreground">Use in Authorization header: <code className="bg-muted px-1 rounded">Bearer {apiKey.slice(0, 12)}…</code></p>
        <div className="flex gap-2">
          <Input value={apiKey} readOnly className="font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={() => copy(apiKey, 'key')}>
            {copied === 'key' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={regenerating}>
            <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="rounded-md bg-muted p-3 text-xs space-y-1">
        <p className="font-medium">Example payload</p>
        <pre className="text-muted-foreground whitespace-pre-wrap">{`{
  "company": "Acme Corp",
  "full_name": "Jane Smith",
  "email": "jane@acme.com",
  "phone": "0712345678"
}`}</pre>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create IntegrationSettings.tsx**

```tsx
// frontend/src/components/settings/IntegrationSettings.tsx
import { useEffect, useState } from 'react'
import { Plus, Trash2, Power, PowerOff, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Button }      from '@/components/ui/button'
import { Input }       from '@/components/ui/input'
import { Label }       from '@/components/ui/label'
import { Badge }       from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { WebhookSetupPanel } from '@/components/integrations/WebhookSetupPanel'
import {
  getIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  type Integration,
  type IntegrationWithKey,
} from '@/services/integrationService'

export function IntegrationSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showAdd,      setShowAdd]      = useState(false)
  const [newName,      setNewName]      = useState('')
  const [creating,     setCreating]     = useState(false)
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [detail,       setDetail]       = useState<IntegrationWithKey | null>(null)

  const load = async () => {
    try {
      const data = await getIntegrations()
      setIntegrations(data)
    } catch {
      toast.error('Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const integration = await createIntegration({
        name:   newName.trim(),
        type:   'inbound_webhook',
        config: {},
      })
      setIntegrations(prev => [...prev, integration])
      setNewName('')
      setShowAdd(false)
      setExpanded(integration.id)
      setDetail(integration)
      toast.success('Integration created')
    } catch {
      toast.error('Failed to create integration')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); setDetail(null); return }
    setExpanded(id)
    try {
      const full = await getIntegration(id)
      setDetail(full)
    } catch {
      toast.error('Failed to load integration details')
    }
  }

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await updateIntegration(id, { isActive: !current })
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, isActive: !current } : i))
      toast.success(current ? 'Integration disabled' : 'Integration enabled')
    } catch {
      toast.error('Failed to update integration')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this integration? Incoming leads already in the queue will not be affected.')) return
    try {
      await deleteIntegration(id)
      setIntegrations(prev => prev.filter(i => i.id !== id))
      if (expanded === id) { setExpanded(null); setDetail(null) }
      toast.success('Integration deleted')
    } catch {
      toast.error('Failed to delete integration')
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading integrations…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Inbound Webhook Integrations</p>
          <p className="text-xs text-muted-foreground">Connect external sources to automatically receive leads</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Integration
        </Button>
      </div>

      {integrations.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No integrations yet</p>
      ) : (
        <div className="space-y-2">
          {integrations.map(integration => (
            <div key={integration.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${integration.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <p className="text-sm font-medium">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {integration.lastSyncedAt
                        ? `Last activity ${formatDistanceToNow(new Date(integration.lastSyncedAt), { addSuffix: true })}`
                        : 'No activity yet'}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">Webhook</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleToggleActive(integration.id, integration.isActive)}
                    title={integration.isActive ? 'Disable' : 'Enable'}
                  >
                    {integration.isActive
                      ? <Power className="h-4 w-4 text-green-600" />
                      : <PowerOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(integration.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => handleToggleExpand(integration.id)}
                  >
                    {expanded === integration.id
                      ? <ChevronUp className="h-4 w-4" />
                      : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {expanded === integration.id && detail?.id === integration.id && (
                <div className="border-t p-4 bg-muted/30">
                  <WebhookSetupPanel
                    integrationId={integration.id}
                    apiKey={detail.apiKey}
                    onKeyRegenerated={(newKey) =>
                      setDetail(prev => prev ? { ...prev, apiKey: newKey } : prev)
                    }
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook Integration</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Integration Name</Label>
              <Input
                placeholder="e.g. Website Contact Form"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/integrations/WebhookSetupPanel.tsx \
        frontend/src/components/settings/IntegrationSettings.tsx
git commit -m "feat(frontend): add IntegrationSettings and WebhookSetupPanel components"
```

---

## Task 13: Wire up sidebar, App route, and WorkspaceSettings tab

**Files:**
- Modify: `frontend/src/pages/admin/WorkspaceSettings.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add Integrations tab to WorkspaceSettings.tsx**

Open `frontend/src/pages/admin/WorkspaceSettings.tsx`.

Add import at the top:
```typescript
import { IntegrationSettings } from '@/components/settings/IntegrationSettings'
import { Webhook } from 'lucide-react'
```

Change the `TabsList` grid from `grid-cols-4` to `grid-cols-5`:
```tsx
<TabsList className="grid w-full grid-cols-5">
```

Add the new trigger after the `branding` trigger:
```tsx
<TabsTrigger value="integrations" className="flex items-center gap-1.5 text-xs">
  <Webhook className="h-3.5 w-3.5" /> Integrations
</TabsTrigger>
```

Add the new tab content after the `branding` TabsContent:
```tsx
<TabsContent value="integrations">
  <Card>
    <CardHeader>
      <CardTitle>Integrations</CardTitle>
      <CardDescription>Connect external sources to receive leads automatically</CardDescription>
    </CardHeader>
    <CardContent>
      <IntegrationSettings />
    </CardContent>
  </Card>
</TabsContent>
```

- [ ] **Step 2: Add Incoming Leads to Sidebar.tsx**

Open `frontend/src/components/layout/Sidebar.tsx`.

Add import:
```typescript
import { Webhook } from 'lucide-react'
```

Add to `adminNavItems` array (before workspace-settings):
```typescript
{
  to:    '/incoming-leads',
  icon:  <Webhook className="h-5 w-5 flex-shrink-0" />,
  label: 'Incoming Leads',
},
```

- [ ] **Step 3: Add route in App.tsx**

Open `frontend/src/App.tsx`.

Add import:
```typescript
import { IncomingLeadsPage } from '@/pages/admin/IncomingLeadsPage'
```

Add route after the `workspace-settings` route:
```tsx
<Route
  path="incoming-leads"
  element={
    <RoleGuard allowedRoles={['admin']}>
      <IncomingLeadsPage />
    </RoleGuard>
  }
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/admin/WorkspaceSettings.tsx \
        frontend/src/components/layout/Sidebar.tsx \
        frontend/src/App.tsx
git commit -m "feat(frontend): wire Incoming Leads page and Integrations tab into app"
```

---

## Task 14: End-to-end smoke test + push

- [ ] **Step 1: Build and start Docker locally**

```bash
docker compose build backend frontend
docker compose up -d
```

- [ ] **Step 2: Smoke test inbound webhook**

1. Open `http://abanscrm.localhost/workspace-settings`
2. Click the **Integrations** tab
3. Click **Add Integration**, name it `Test Form`, click **Create**
4. Expand the integration — copy the Webhook URL
5. Send a test lead via curl (replace URL with copied value):

```bash
curl -X POST "http://abanscrm.localhost/api/inbound/<your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"company": "Test Corp", "full_name": "Alice Brown", "email": "alice@test.com"}'
```

Expected: `{"id":"...","status":"pending","duplicateOf":null}`

- [ ] **Step 3: Smoke test review queue**

1. Open `http://abanscrm.localhost/incoming-leads`
2. Confirm "Test Corp — Alice Brown" appears in Pending tab
3. Click **Approve** — confirm toast "Lead approved and added to pipeline"
4. Go to `/leads` — confirm Test Corp appears there
5. Send the same curl again — confirm the second lead shows `"duplicateOf": "<lead-id>"` in response
6. Open Incoming Leads — confirm duplicate warning shows on the second lead

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

---

*Plans 2 and 3 (HTTP Poll outbound and Facebook Lead Ads) will be written separately.*
