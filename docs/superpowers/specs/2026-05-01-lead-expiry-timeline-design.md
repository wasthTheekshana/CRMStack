# Lead Expiry & Timeline Design

**Goal:** Show how long each lead has been open (timeline since creation) and let admins or the lead's assigned sales person set an expiry date. When expiry approaches, send in-app reminder notifications to the lead owner and all admins at 7 days, 5 days, 2 days, 1 day before, and on the expiry day itself.

**Architecture:** A new `lead_expiry` table (no changes to `leads`) stores one expiry record per lead with boolean flags tracking which reminders have been sent. The existing daily scheduler is extended with a second job that checks pending reminders and fires notifications. A shared `LeadExpiryPanel` component handles display and editing across DealModal, LeadsPage, and KanbanCard.

**Tech Stack:** Express/TypeScript backend, PostgreSQL, node-cron scheduler, React 18 + shadcn/ui frontend, existing `notify()` from `notificationService`.

---

## What Already Exists (do not rewrite)

- `notify()` in `backend/src/services/notificationService.ts` — base notification function
- Daily scheduler in `backend/src/scheduler.ts` — runs at 08:00, already handles task reminders
- `useLeads` hook — fetches and caches all leads for the current tenant
- `useIsAdmin()` — checks if current user is admin
- `useAuthStore` — provides `userProfile.id` for ownership check
- In-app notification panel — already renders all notification types

---

## Database

### New Table

**File:** `backend/migrations/014_lead_expiry.sql`

```sql
CREATE TABLE lead_expiry (
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

CREATE INDEX lead_expiry_tenant_date_idx ON lead_expiry(tenant_id, expiry_date);
```

**Key constraints:**
- `UNIQUE(lead_id)` — one active expiry per lead; upsert replaces it
- `ON DELETE CASCADE` — expiry row removed automatically when lead is deleted
- `tenant_id` stored directly for fast scheduler queries without joining `leads`
- Index on `(tenant_id, expiry_date)` for the daily scheduler scan

---

## Backend

### New Model

**File:** `backend/src/models/leadExpiryModel.ts`

```typescript
export interface LeadExpiry {
  id:              string;
  leadId:          string;
  tenantId:        string;
  expiryDate:      string;   // ISO date "YYYY-MM-DD"
  setBy:           string;
  notified7d:      boolean;
  notified5d:      boolean;
  notified2d:      boolean;
  notified1d:      boolean;
  notifiedExpired: boolean;
  createdAt:       string;
  updatedAt:       string;
}

// Functions:
// getExpiry(leadId)                           → LeadExpiry | null
// upsertExpiry(leadId, tenantId, expiryDate, setBy) → LeadExpiry
//   — resets all notified_* flags to FALSE on update
// deleteExpiry(leadId, tenantId)              → void
// getExpiryByTenant(tenantId)                 → { leadId, expiryDate }[]  (bulk endpoint)
// getLeadsWithPendingReminders()              → rows joined with leads for scheduler use
// markReminderSent(leadId, interval)          → void
//   interval: '7d' | '5d' | '2d' | '1d' | 'expired' — flips the matching flag
```

`upsertExpiry` SQL pattern:
```sql
INSERT INTO lead_expiry (lead_id, tenant_id, expiry_date, set_by)
VALUES ($1, $2, $3, $4)
ON CONFLICT (lead_id) DO UPDATE SET
  expiry_date      = $3,
  set_by           = $4,
  notified_7d      = FALSE,
  notified_5d      = FALSE,
  notified_2d      = FALSE,
  notified_1d      = FALSE,
  notified_expired = FALSE,
  updated_at       = NOW()
RETURNING *
```

### New Routes

**File:** `backend/src/routes/leads.ts` — add below existing routes:

```typescript
router.get( '/expiry/bulk',  requireAuth, getBulkLeadExpiryHandler);  // must be before /:id routes
router.get( '/:id/expiry',   requireAuth, getLeadExpiryHandler);
router.put( '/:id/expiry',   requireAuth, setLeadExpiryHandler);
router.delete('/:id/expiry', requireAuth, deleteLeadExpiryHandler);
```

Note: `/expiry/bulk` must be registered **before** `/:id/expiry` so Express does not treat `"bulk"` as a lead ID.

### New Handlers

**File:** `backend/src/controllers/leadExpiryController.ts`

**`getBulkLeadExpiryHandler`** — calls `getExpiryByTenant(tenantId)`, returns a map `{ [leadId]: { expiryDate, daysUntil } }`. Used by LeadsPage and KanbanBoard on initial load.

**`getLeadExpiryHandler`** — returns the expiry row for the lead (or `null`). Any authenticated user in the tenant can read it.

**`setLeadExpiryHandler`**:
```typescript
// body: { expiryDate: "YYYY-MM-DD" }
// Authorization: admin OR lead owner (ownerId === req.user.userId)
// Validates: expiryDate must be a future date
// Calls: upsertExpiry(leadId, tenantId, expiryDate, userId)
```

**`deleteLeadExpiryHandler`**:
```typescript
// Authorization: admin OR lead owner
// Calls: deleteExpiry(leadId, tenantId)
```

Authorization check (shared by set and delete):
```typescript
const lead = await findLeadById(id, actor.tenantId);
if (!lead) { res.status(404)...; return; }
const isAdmin = actor.role === 'admin';
const isOwner = lead.ownerId === actor.userId;
if (!isAdmin && !isOwner) { res.status(403)...; return; }
```

### New Notification Types

**File:** `backend/src/services/notificationService.ts` — add:

```typescript
export async function notifyLeadExpiryReminder({
  tenantId, leadId, companyName, daysUntil, recipientIds,
}: {
  tenantId:     string;
  leadId:       string;
  companyName:  string;
  daysUntil:    number;   // 7, 5, 2, 1, or 0
  recipientIds: string[];
}) {
  const isExpired = daysUntil === 0;
  const title = isExpired
    ? `Lead has expired: ${companyName}`
    : `Lead expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}: ${companyName}`;
  const type = isExpired ? 'lead_expired' : 'lead_expiry_reminder';

  for (const userId of recipientIds) {
    await notify({ tenantId, userId, type, title,
      body: isExpired
        ? `${companyName} has passed its expiry date.`
        : `${companyName} will expire in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`,
      link: `/leads`,
    });
  }
}
```

Add `'lead_expiry_reminder'` and `'lead_expired'` to the notification type union.

### Scheduler Extension

**File:** `backend/src/scheduler.ts` — add alongside the existing task job:

```typescript
async function checkLeadExpiry() {
  const rows = await getLeadsWithPendingReminders(); // all rows where any flag is still false
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const row of rows) {
    const expiry = new Date(row.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);

    const shouldNotify =
      (daysUntil === 7 && !row.notified7d)      ? '7d'      :
      (daysUntil === 5 && !row.notified5d)      ? '5d'      :
      (daysUntil === 2 && !row.notified2d)      ? '2d'      :
      (daysUntil === 1 && !row.notified1d)      ? '1d'      :
      (daysUntil === 0 && !row.notifiedExpired) ? 'expired' :
      null;

    if (!shouldNotify) continue;

    // Collect recipients: lead owner + all admins in the tenant (deduplicated)
    // findAdminsByTenant uses existing findAllUsers(tenantId) filtered to role === 'admin'
    const admins = await findAdminsByTenant(row.tenantId);
    const recipientIds = [...new Set([row.ownerId, ...admins.map(a => a.id)])];

    await notifyLeadExpiryReminder({
      tenantId: row.tenantId,
      leadId:   row.leadId,
      companyName: row.companyName,
      daysUntil,
      recipientIds,
    });

    await markReminderSent(row.leadId, shouldNotify); // flips the correct flag
  }
}

// Schedule alongside existing job — same 08:00 daily cron
cron.schedule('0 8 * * *', checkLeadExpiry);
```

`getLeadsWithPendingReminders` returns only rows where at least one flag is still FALSE and expiry_date is within the next 7 days (or already passed and not yet notified), joined with `leads` for `owner_id` and `company_name`.

---

## Frontend

### New Service

**File:** `frontend/src/services/leadExpiryService.ts`

```typescript
export interface LeadExpiry {
  id:         string
  leadId:     string
  expiryDate: string   // "YYYY-MM-DD"
  setBy:      string
  createdAt:  string
  updatedAt:  string
}

export const getLeadExpiry  = (leadId: string) =>
  apiFetch<LeadExpiry | null>(`/api/leads/${leadId}/expiry`)

export const setLeadExpiry  = (leadId: string, expiryDate: string) =>
  apiFetch<LeadExpiry>(`/api/leads/${leadId}/expiry`, {
    method: 'PUT',
    body: JSON.stringify({ expiryDate }),
  })

export const deleteLeadExpiry = (leadId: string) =>
  apiFetch<void>(`/api/leads/${leadId}/expiry`, { method: 'DELETE' })
```

### New Shared Component

**File:** `frontend/src/components/leads/LeadExpiryPanel.tsx`

Props:
```typescript
interface Props {
  leadId:     string
  ownerId:    string
  onChanged?: () => void   // called after set/delete so parent can refresh
}
```

Behaviour:
- On mount, fetches expiry via `getLeadExpiry(leadId)`
- Computes `daysOpen` from `lead.createdAt` (passed from parent or re-fetched)
- Computes `daysUntil` from `expiryDate - today`
- Renders the timeline line: `Open for {daysOpen} days`
- Renders the status badge (see badge logic below)
- If current user is admin or ownerId matches current user:
  - Shows a `<input type="date">` pre-filled with current expiry date
  - Shows "Set Expiry" / "Update Expiry" button
  - Shows "Remove" button when expiry is set
- On save: calls `setLeadExpiry`, refreshes local state, calls `onChanged?.()`
- On remove: calls `deleteLeadExpiry`, refreshes, calls `onChanged?.()`
- `toast.error` on API failure

**Badge logic:**

| Condition | Badge colour | Text |
|---|---|---|
| No expiry set | Grey | "No expiry set" |
| daysUntil > 7 | Green | "Expires in X days" |
| 3 ≤ daysUntil ≤ 7 | Amber | "Expires in X days" |
| 1 ≤ daysUntil ≤ 2 | Orange | "Expires in X days" |
| daysUntil === 0 | Red | "Expires today" |
| daysUntil < 0 | Red | "Expired X days ago" |

### Where It Appears

**`DealModal.tsx`** — add a dedicated "Timeline" section below the Owner row:
- Full `<LeadExpiryPanel>` (badge + date picker + remove button)
- "Open for X days" line always visible

**`LeadsPage.tsx`** — on each lead card, add the expiry badge chip (read-only, no date picker). Fetch expiry data as part of the leads list — add a `GET /api/leads/expiry/bulk?tenantId=...` endpoint that returns all expiry records for a tenant in one call, keyed by `leadId`. This avoids N individual fetches.

**`KanbanCard.tsx`** — add the expiry badge chip at the bottom of the card alongside the owner chip. Uses the same bulk-fetched data from a shared context or prop passed from `KanbanBoard`.

### Bulk Expiry Fetch

**New endpoint:** `GET /api/leads/expiry/bulk`

Returns: `{ [leadId: string]: { expiryDate: string; daysUntil: number } }`

Used by `LeadsPage` and `KanbanBoard` on initial load and after any expiry change. Stored in a `useLeadExpiry` hook so the data is shared between the list and the cards without duplicate fetches.

**File:** `frontend/src/hooks/useLeadExpiry.ts`

```typescript
// Fetches all expiry records for the current tenant once
// Provides: expiryMap (leadId → expiry data), refetch()
// Used by: LeadsPage, KanbanBoard
```

---

## Data Flow

```
User opens DealModal
  → LeadExpiryPanel mounts → GET /api/leads/:id/expiry
  → shows current expiry date + badge + date picker (if authorized)

Admin/owner sets expiry date
  → PUT /api/leads/:id/expiry { expiryDate }
    → upsert lead_expiry row, reset all flags
  → onChanged() → refetch expiry → badge updates

Daily scheduler (08:00)
  → checkLeadExpiry()
    → finds leads where daysUntil matches a flag that is still FALSE
    → sends notifications to owner + all admins
    → flips the flag

LeadsPage / KanbanBoard loads
  → GET /api/leads/expiry/bulk
  → expiryMap passed to each card → badge rendered
```

---

## Security

- `GET /api/leads/:id/expiry` — any authenticated tenant user
- `PUT` / `DELETE` `/api/leads/:id/expiry` — admin or lead owner only (403 otherwise)
- All queries filter by `tenant_id` — cross-tenant access impossible
- Bulk endpoint filters by `req.user.tenantId`

---

## Error States

| Scenario | Handling |
|---|---|
| expiryDate is in the past (on set) | 400 — "Expiry date must be in the future" |
| Lead not found / wrong tenant | 404 |
| User is neither admin nor owner | 403 |
| Lead deleted | expiry row cascades away; bulk endpoint returns nothing for that leadId |
| Scheduler fires when no expiry rows exist | no-op, logs "0 expiry reminders sent" |
