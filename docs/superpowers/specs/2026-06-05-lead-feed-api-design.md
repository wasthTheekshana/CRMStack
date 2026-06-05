# Lead Feed API — Design Spec

**Date:** 2026-06-05
**Status:** Approved

---

## Goal

Allow leads to flow into DOK CRM automatically from external sources (website forms, Facebook Lead Ads, third-party APIs) and let admins review them before they enter the pipeline.

---

## Decisions

| Question | Decision |
|---|---|
| Inbound auth | Both API key header AND unique webhook URL per integration |
| Review flow | All incoming leads go to a review queue first (never auto-import) |
| Duplicate detection | Flag as possible duplicate in queue — admin decides |
| Field mapping | Smart defaults (common name variations auto-mapped) + unknown fields → `custom_fields` |
| Outbound sources (v1) | Facebook Lead Ads + Generic HTTP polling |
| Architecture | Full integration hub — 3 new tables |

---

## Database

### New table: `integrations`

```sql
CREATE TABLE integrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL CHECK (type IN ('inbound_webhook', 'facebook_lead_ads', 'http_poll')),
  config         JSONB NOT NULL DEFAULT '{}',
  api_key        TEXT NOT NULL UNIQUE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_integrations_tenant_id ON integrations(tenant_id);
CREATE INDEX idx_integrations_api_key   ON integrations(api_key);
```

**`config` shape by type:**

```typescript
// inbound_webhook
{ assigned_to: string }  // userId to assign incoming leads to

// facebook_lead_ads
{ page_id: string; form_id: string; access_token: string; ad_account_id: string }

// http_poll
{ url: string; headers: Record<string, string>; interval_hours: number; leads_path?: string }
```

---

### New table: `incoming_leads`

```sql
CREATE TABLE incoming_leads (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  raw_data       JSONB NOT NULL,
  mapped_data    JSONB NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  duplicate_of   UUID REFERENCES leads(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at    TIMESTAMPTZ,
  reviewed_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_incoming_leads_tenant_id      ON incoming_leads(tenant_id);
CREATE INDEX idx_incoming_leads_integration_id ON incoming_leads(integration_id);
CREATE INDEX idx_incoming_leads_status         ON incoming_leads(status);
```

---

### New table: `integration_logs`

```sql
CREATE TABLE integration_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_at         TIMESTAMPTZ DEFAULT NOW(),
  status         TEXT NOT NULL CHECK (status IN ('success', 'error')),
  leads_fetched  INTEGER NOT NULL DEFAULT 0,
  leads_created  INTEGER NOT NULL DEFAULT 0,
  error_message  TEXT
);

CREATE INDEX idx_integration_logs_integration_id ON integration_logs(integration_id);
```

---

## Smart Field Mapper

A shared utility function used by all integration types.

```typescript
// backend/src/lib/fieldMapper.ts

const FIELD_MAP: Record<string, string> = {
  name:           'contact_name',
  full_name:      'contact_name',
  contact_name:   'contact_name',
  contact:        'contact_name',
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

const CRM_FIELDS = new Set(['contact_name', 'company_name', 'email', 'phone', 'value', 'remarks'])

export function mapFields(raw: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}
  const custom: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(raw)) {
    const normalised = key.toLowerCase().replace(/[\s-]/g, '_')
    const crmField = FIELD_MAP[normalised]
    if (crmField) {
      mapped[crmField] = val
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

---

## Duplicate Detection

```typescript
// Returns the lead_id if a duplicate is found, null otherwise
async function findDuplicate(tenantId: string, mappedData: Record<string, unknown>): Promise<string | null> {
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
```

---

## Backend

### New files

**`backend/src/migrations/018_integrations.sql`**
Creates the 3 tables above.

**`backend/src/lib/fieldMapper.ts`**
Smart field mapper utility (see above).

**`backend/src/models/integrationModel.ts`**
- `findIntegrationByApiKey(apiKey)`
- `findIntegrationsByTenant(tenantId)`
- `createIntegration(tenantId, data)`
- `updateIntegration(id, tenantId, data)`
- `deleteIntegration(id, tenantId)`
- `updateLastSynced(id)`

**`backend/src/models/incomingLeadModel.ts`**
- `createIncomingLead(data)` — inserts into queue
- `findIncomingLeads(tenantId, status?)` — list for review page
- `approveIncomingLead(id, reviewedBy)` — creates real lead, marks approved
- `rejectIncomingLead(id, reviewedBy)` — marks rejected
- `findIncomingLeadById(id, tenantId)`

**`backend/src/models/integrationLogModel.ts`**
- `createLog(integrationId, tenantId, data)`
- `findLogsByIntegration(integrationId, limit)`

**`backend/src/controllers/integrationController.ts`**
- `listIntegrations` — `GET /api/integrations`
- `createIntegration` — `POST /api/integrations`
- `updateIntegration` — `PUT /api/integrations/:id`
- `deleteIntegration` — `DELETE /api/integrations/:id`
- `regenerateApiKey` — `POST /api/integrations/:id/regenerate-key`
- `getLogs` — `GET /api/integrations/:id/logs`

**`backend/src/controllers/incomingLeadController.ts`**
- `listIncomingLeads` — `GET /api/incoming-leads`
- `approveIncomingLead` — `POST /api/incoming-leads/:id/approve`
- `rejectIncomingLead` — `POST /api/incoming-leads/:id/reject`
- `updateIncomingLead` — `PUT /api/incoming-leads/:id` (edit before approving)
- `bulkApprove` — `POST /api/incoming-leads/bulk-approve`
- `bulkReject` — `POST /api/incoming-leads/bulk-reject`

**`backend/src/controllers/inboundWebhookController.ts`**
- `receiveWebhook` — `POST /api/inbound/:apiKey` and `POST /api/inbound` (with Bearer header)
  1. Look up integration by api_key — 401 if not found or inactive
  2. Run `mapFields(body)`
  3. Run `findDuplicate(tenantId, mappedData)`
  4. Insert into `incoming_leads`
  5. Insert admin notification: `"New lead from {integration.name}"`
  6. Return `201 { id, status: 'pending' }`

**`backend/src/services/httpPollService.ts`**
- `runHttpPoll(integration)` — fetches URL, maps fields, inserts new incoming leads, writes log

**`backend/src/services/facebookService.ts`**
- `handleFacebookWebhook(body)` — receives real-time Facebook Lead Ads push
- `pollFacebookForm(integration)` — fallback hourly poll of Graph API

### Modified files

**`backend/src/routes/index.ts`**
```typescript
app.use('/api/integrations',    integrationRoutes)
app.use('/api/incoming-leads',  incomingLeadRoutes)
app.use('/api/inbound',         inboundWebhookRoutes)   // public — no auth middleware
app.use('/api/facebook',        facebookWebhookRoutes)  // public — Facebook verification
```

**`backend/src/scheduler.ts`**
Add a job that runs every hour:
1. Find all active `http_poll` integrations where `last_synced_at + interval_hours < NOW()`
2. Call `runHttpPoll(integration)` for each
3. Find all active `facebook_lead_ads` integrations
4. Call `pollFacebookForm(integration)` for each (fallback sync)

---

## Frontend

### New files

**`frontend/src/services/integrationService.ts`**
```typescript
getIntegrations(): Promise<Integration[]>
createIntegration(data): Promise<Integration>
updateIntegration(id, data): Promise<Integration>
deleteIntegration(id): Promise<void>
regenerateApiKey(id): Promise<{ apiKey: string }>
getIntegrationLogs(id): Promise<IntegrationLog[]>
```

**`frontend/src/services/incomingLeadService.ts`**
```typescript
getIncomingLeads(status?: string): Promise<IncomingLead[]>
approveIncomingLead(id): Promise<Lead>
rejectIncomingLead(id): Promise<void>
updateIncomingLead(id, data): Promise<IncomingLead>
bulkApprove(ids: string[]): Promise<void>
bulkReject(ids: string[]): Promise<void>
```

**`frontend/src/pages/admin/IncomingLeadsPage.tsx`**

Review queue page — admin only.

Layout:
- Top: filter tabs `All | Pending (N) | Approved | Rejected` + source filter dropdown + bulk action buttons
- List: lead cards with approve / reject / edit actions, duplicate warning badge
- Sidebar: integration health panel showing last sync time and status per integration

**`frontend/src/components/settings/IntegrationSettings.tsx`**

New tab inside `WorkspaceSettings`. Lists integrations with status, last sync, and action buttons. "Add Integration" opens a modal with type selector (Webhook / HTTP Poll / Facebook).

**`frontend/src/components/integrations/AddIntegrationModal.tsx`**

Step 1 — choose type: Inbound Webhook | HTTP Poll | Facebook Lead Ads
Step 2 — type-specific form
Step 3 — confirmation with webhook URL / API key shown

**`frontend/src/components/integrations/WebhookSetupPanel.tsx`**
Shows API key, webhook URL with copy button, regenerate key button, assign-to dropdown.

**`frontend/src/components/integrations/HttpPollSetupPanel.tsx`**
URL field, headers (key-value pairs), interval selector, optional leads JSON path field.

**`frontend/src/components/integrations/FacebookSetupPanel.tsx`**
"Connect Facebook" OAuth button → ad account selector → lead form selector.

### Modified files

**`frontend/src/pages/admin/WorkspaceSettings.tsx`**
Add "Integrations" tab that renders `<IntegrationSettings />`.

**`frontend/src/App.tsx`**
Add route: `/admin/incoming-leads` → `<IncomingLeadsPage />`

**`frontend/src/components/layout/Sidebar.tsx`**
Add "Incoming Leads" link with pending count badge (visible to admins only).

---

## TypeScript Types

```typescript
type IntegrationType = 'inbound_webhook' | 'facebook_lead_ads' | 'http_poll'

interface Integration {
  id:            string
  tenantId:      string
  name:          string
  type:          IntegrationType
  config:        Record<string, unknown>
  apiKey:        string
  isActive:      boolean
  lastSyncedAt:  string | null
  createdAt:     string
}

interface IncomingLead {
  id:            string
  tenantId:      string
  integrationId: string
  integrationName: string
  rawData:       Record<string, unknown>
  mappedData:    Record<string, unknown>
  status:        'pending' | 'approved' | 'rejected'
  duplicateOf:   string | null           // lead id
  duplicateName: string | null           // lead company name for display
  createdAt:     string
  reviewedAt:    string | null
  reviewedBy:    string | null
}

interface IntegrationLog {
  id:            string
  integrationId: string
  runAt:         string
  status:        'success' | 'error'
  leadsFetched:  number
  leadsCreated:  number
  errorMessage:  string | null
}
```

---

## Notifications

When new incoming leads arrive, admins receive a notification:
- `type: 'incoming_leads'`
- `message: '3 new leads from Facebook Lead Ads waiting for review'`
- Links to `/admin/incoming-leads`

Add `incoming_leads` to the notification type check constraint in the DB.

---

## Facebook App Setup (one-time)

1. Create a Facebook App at developers.facebook.com
2. Add "Facebook Login" and "Lead Ads Retrieval" products
3. Set `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` in backend `.env`
4. Register webhook callback URL: `POST /api/facebook/webhook`
5. Request `leads_retrieval` and `pages_manage_ads` permissions

This is a DOK company-level setup. All tenants share the same Facebook App.

---

## Out of Scope

- LinkedIn Lead Gen Forms (future)
- Google Ads Lead Extensions (future)
- Auto-import without review queue
- Editing raw_data after receipt (only mapped_data is editable)
- Real-time queue updates via WebSocket (queue refreshes on page visit)
