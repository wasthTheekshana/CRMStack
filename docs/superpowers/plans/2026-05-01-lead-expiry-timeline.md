# Lead Expiry & Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lead timeline (age since creation) and expiry date to every lead, with in-app reminder notifications at 7/5/2/1 days before and on expiry day, sent to the lead owner and all tenant admins.

**Architecture:** A new `lead_expiry` table stores one expiry record per lead with five boolean flags tracking which reminders have been sent. The existing daily scheduler at 08:00 is extended with a `checkLeadExpiry` job. A shared `LeadExpiryPanel` component (full editor) and `ExpiryBadge` component (read-only chip) are wired into DealModal, KanbanCard, and LeadsPage. Bulk expiry data is fetched once per page load via `GET /api/leads/expiry/bulk` and shared via a `useLeadExpiry` hook.

**Tech Stack:** Express/TypeScript backend, PostgreSQL, node-cron, React 18 + shadcn/ui, existing `notify()` from `notificationService.ts`, existing `apiFetch` from `@/config/api`.

---

## File Map

### Create
- `backend/migrations/014_lead_expiry.sql` — new table DDL
- `backend/src/models/leadExpiryModel.ts` — all DB queries for lead_expiry
- `backend/src/controllers/leadExpiryController.ts` — 4 HTTP handlers
- `frontend/src/services/leadExpiryService.ts` — API call functions
- `frontend/src/hooks/useLeadExpiry.ts` — bulk expiry data hook
- `frontend/src/components/leads/ExpiryBadge.tsx` — read-only coloured badge chip
- `frontend/src/components/leads/LeadExpiryPanel.tsx` — full editor (badge + date picker + remove)

### Modify
- `backend/src/models/userModel.ts` — add `findAdminsByTenant`
- `backend/src/routes/leads.ts` — register 4 new expiry routes
- `backend/src/services/notificationService.ts` — add `notifyLeadExpiryReminder`
- `backend/src/scheduler.ts` — add `checkLeadExpiry` cron job
- `frontend/src/components/kanban/DealModal.tsx` — add Timeline section
- `frontend/src/components/kanban/KanbanCard.tsx` — add expiry badge chip
- `frontend/src/components/kanban/KanbanBoard.tsx` — pass expiryMap to columns/cards
- `frontend/src/pages/shared/LeadsPage.tsx` — add expiry badge to lead cards

---

## Task 1: Database Migration

**Files:**
- Create: `backend/migrations/014_lead_expiry.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
```

- [ ] **Step 2: Run the migration against the database**

```bash
# From the backend directory — adjust connection string to match your .env
cd backend
psql $DATABASE_URL -f migrations/014_lead_expiry.sql
```

Expected output:
```
CREATE TABLE
CREATE INDEX
```

- [ ] **Step 3: Verify the table exists**

```bash
psql $DATABASE_URL -c "\d lead_expiry"
```

Expected: table columns listed including `notified_7d`, `notified_expired`, `UNIQUE(lead_id)` constraint.

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/014_lead_expiry.sql
git commit -m "feat: add lead_expiry migration"
```

---

## Task 2: Backend Model — `leadExpiryModel.ts`

**Files:**
- Create: `backend/src/models/leadExpiryModel.ts`

- [ ] **Step 1: Create the model file with all query functions**

```typescript
// backend/src/models/leadExpiryModel.ts
import { query } from '../config/db';

export interface LeadExpiry {
  id:              string;
  leadId:          string;
  tenantId:        string;
  expiryDate:      string;   // "YYYY-MM-DD"
  setBy:           string;
  notified7d:      boolean;
  notified5d:      boolean;
  notified2d:      boolean;
  notified1d:      boolean;
  notifiedExpired: boolean;
  createdAt:       string;
  updatedAt:       string;
}

export interface ExpiryReminderRow {
  leadId:          string;
  tenantId:        string;
  expiryDate:      string;
  ownerId:         string;
  companyName:     string;
  notified7d:      boolean;
  notified5d:      boolean;
  notified2d:      boolean;
  notified1d:      boolean;
  notifiedExpired: boolean;
}

const mapExpiry = (row: Record<string, unknown>): LeadExpiry => ({
  id:              row.id              as string,
  leadId:          row.lead_id         as string,
  tenantId:        row.tenant_id       as string,
  expiryDate:      row.expiry_date     as string,
  setBy:           row.set_by          as string,
  notified7d:      row.notified_7d     as boolean,
  notified5d:      row.notified_5d     as boolean,
  notified2d:      row.notified_2d     as boolean,
  notified1d:      row.notified_1d     as boolean,
  notifiedExpired: row.notified_expired as boolean,
  createdAt:       row.created_at      as string,
  updatedAt:       row.updated_at      as string,
});

export async function getExpiry(leadId: string): Promise<LeadExpiry | null> {
  const result = await query(
    'SELECT * FROM lead_expiry WHERE lead_id = $1',
    [leadId]
  );
  return result.rows[0] ? mapExpiry(result.rows[0]) : null;
}

export async function upsertExpiry(
  leadId:     string,
  tenantId:   string,
  expiryDate: string,
  setBy:      string
): Promise<LeadExpiry> {
  const result = await query(
    `INSERT INTO lead_expiry (lead_id, tenant_id, expiry_date, set_by)
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
     RETURNING *`,
    [leadId, tenantId, expiryDate, setBy]
  );
  return mapExpiry(result.rows[0]);
}

export async function deleteExpiry(leadId: string, tenantId: string): Promise<void> {
  await query(
    'DELETE FROM lead_expiry WHERE lead_id = $1 AND tenant_id = $2',
    [leadId, tenantId]
  );
}

export async function getExpiryByTenant(
  tenantId: string
): Promise<{ leadId: string; expiryDate: string }[]> {
  const result = await query(
    'SELECT lead_id, expiry_date FROM lead_expiry WHERE tenant_id = $1',
    [tenantId]
  );
  return result.rows.map(row => ({
    leadId:     row.lead_id    as string,
    expiryDate: row.expiry_date as string,
  }));
}

export async function getLeadsWithPendingReminders(): Promise<ExpiryReminderRow[]> {
  const result = await query(
    `SELECT
       le.lead_id,
       le.tenant_id,
       le.expiry_date,
       le.notified_7d,
       le.notified_5d,
       le.notified_2d,
       le.notified_1d,
       le.notified_expired,
       l.owner_id,
       l.company_name
     FROM lead_expiry le
     JOIN leads l ON l.id = le.lead_id
     WHERE l.is_deleted = FALSE
       AND le.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
       AND NOT (
         le.notified_7d AND le.notified_5d AND le.notified_2d
         AND le.notified_1d AND le.notified_expired
       )`,
    []
  );
  return result.rows.map(row => ({
    leadId:          row.lead_id          as string,
    tenantId:        row.tenant_id        as string,
    expiryDate:      row.expiry_date      as string,
    ownerId:         row.owner_id         as string,
    companyName:     row.company_name     as string,
    notified7d:      row.notified_7d      as boolean,
    notified5d:      row.notified_5d      as boolean,
    notified2d:      row.notified_2d      as boolean,
    notified1d:      row.notified_1d      as boolean,
    notifiedExpired: row.notified_expired as boolean,
  }));
}

export async function markReminderSent(
  leadId:   string,
  interval: '7d' | '5d' | '2d' | '1d' | 'expired'
): Promise<void> {
  const colMap: Record<string, string> = {
    '7d':      'notified_7d',
    '5d':      'notified_5d',
    '2d':      'notified_2d',
    '1d':      'notified_1d',
    'expired': 'notified_expired',
  };
  const col = colMap[interval];
  await query(
    `UPDATE lead_expiry SET ${col} = TRUE, updated_at = NOW() WHERE lead_id = $1`,
    [leadId]
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/leadExpiryModel.ts
git commit -m "feat: add leadExpiryModel with upsert, delete, bulk, and scheduler queries"
```

---

## Task 3: Add `findAdminsByTenant` to `userModel.ts`

**Files:**
- Modify: `backend/src/models/userModel.ts`

The scheduler needs to find all admin users in a tenant to send them expiry notifications. `findAllUsers` already exists — add a targeted helper that filters to admins only.

- [ ] **Step 1: Append `findAdminsByTenant` to the end of `userModel.ts`**

```typescript
export async function findAdminsByTenant(tenantId: string) {
  const result = await query(
    `SELECT id, email, display_name FROM users
     WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE`,
    [tenantId]
  );
  return result.rows as { id: string; email: string; display_name: string }[];
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/userModel.ts
git commit -m "feat: add findAdminsByTenant to userModel"
```

---

## Task 4: Backend Controller + Routes

**Files:**
- Create: `backend/src/controllers/leadExpiryController.ts`
- Modify: `backend/src/routes/leads.ts`

- [ ] **Step 1: Create the controller file**

```typescript
// backend/src/controllers/leadExpiryController.ts
import { Request, Response } from 'express';
import { findLeadById } from '../models/leadModel';
import {
  getExpiry,
  upsertExpiry,
  deleteExpiry,
  getExpiryByTenant,
} from '../models/leadExpiryModel';
import { AuthRequest } from '../middleware/auth';

function daysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
}

export async function getBulkLeadExpiryHandler(req: Request, res: Response) {
  try {
    const actor = (req as AuthRequest).user;
    const rows  = await getExpiryByTenant(actor.tenantId);
    const map: Record<string, { expiryDate: string; daysUntil: number }> = {};
    for (const row of rows) {
      map[row.leadId] = {
        expiryDate: row.expiryDate,
        daysUntil:  daysUntilExpiry(row.expiryDate),
      };
    }
    res.json(map);
  } catch (err) {
    console.error('getBulkLeadExpiryHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getLeadExpiryHandler(req: Request, res: Response) {
  try {
    const actor  = (req as AuthRequest).user;
    const { id } = req.params;
    const lead   = await findLeadById(id, actor.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    const expiry = await getExpiry(id);
    res.json(expiry ?? null);
  } catch (err) {
    console.error('getLeadExpiryHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function setLeadExpiryHandler(req: Request, res: Response) {
  const actor      = (req as AuthRequest).user;
  const { id }     = req.params;
  const { expiryDate } = req.body as { expiryDate?: string };

  if (!expiryDate) {
    res.status(400).json({ error: 'expiryDate is required (YYYY-MM-DD)' }); return;
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
  if (expiry <= today) {
    res.status(400).json({ error: 'Expiry date must be in the future' }); return;
  }

  try {
    const lead = await findLeadById(id, actor.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    const isAdmin = actor.role === 'admin';
    const isOwner = lead.ownerId === actor.userId;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Only admins or the lead owner can set expiry' }); return;
    }

    const result = await upsertExpiry(id, actor.tenantId, expiryDate, actor.userId);
    res.json(result);
  } catch (err) {
    console.error('setLeadExpiryHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteLeadExpiryHandler(req: Request, res: Response) {
  const actor  = (req as AuthRequest).user;
  const { id } = req.params;

  try {
    const lead = await findLeadById(id, actor.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    const isAdmin = actor.role === 'admin';
    const isOwner = lead.ownerId === actor.userId;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Only admins or the lead owner can remove expiry' }); return;
    }

    await deleteExpiry(id, actor.tenantId);
    res.status(204).send();
  } catch (err) {
    console.error('deleteLeadExpiryHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: Register the routes in `backend/src/routes/leads.ts`**

Add the import and four routes. The `/expiry/bulk` route **must** come before `/:id` routes so Express doesn't treat `"bulk"` as a lead ID.

```typescript
// Add to imports at top of backend/src/routes/leads.ts:
import {
  getBulkLeadExpiryHandler,
  getLeadExpiryHandler,
  setLeadExpiryHandler,
  deleteLeadExpiryHandler,
} from '../controllers/leadExpiryController';
```

Add routes before the existing `router.get('/:id', ...)` line:

```typescript
router.get('/expiry/bulk',   requireAuth, getBulkLeadExpiryHandler);
router.get('/:id/expiry',    requireAuth, getLeadExpiryHandler);
router.put('/:id/expiry',    requireAuth, setLeadExpiryHandler);
router.delete('/:id/expiry', requireAuth, deleteLeadExpiryHandler);
```

The final `routes/leads.ts` route order must be:
```
GET  /               listLeads
GET  /deleted        listDeletedLeads
GET  /expiry/bulk    getBulkLeadExpiryHandler   ← new, before /:id
GET  /:id            getLead
GET  /:id/expiry     getLeadExpiryHandler        ← new
POST /               createLeadHandler
PUT  /:id            updateLeadHandler
PUT  /:id/expiry     setLeadExpiryHandler        ← new
PUT  /:id/restore    restoreLeadHandler
DELETE /:id          deleteLeadHandler
DELETE /:id/expiry   deleteLeadExpiryHandler     ← new
PATCH  /:id/owner    reassignLeadHandler
```

- [ ] **Step 3: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Start the backend (`npm run dev` from `backend/`) and run:

```bash
# Should return 200 with an empty object {} (no expiry rows yet)
curl -H "Authorization: Bearer <your_token>" http://localhost:4000/api/leads/expiry/bulk
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/leadExpiryController.ts backend/src/routes/leads.ts
git commit -m "feat: add lead expiry controller and routes"
```

---

## Task 5: Notification Service — `notifyLeadExpiryReminder`

**Files:**
- Modify: `backend/src/services/notificationService.ts`

- [ ] **Step 1: Append `notifyLeadExpiryReminder` to `notificationService.ts`**

```typescript
export async function notifyLeadExpiryReminder(params: {
  tenantId:     string;
  companyName:  string;
  daysUntil:    number;   // 7, 5, 2, 1, or 0
  recipientIds: string[];
}): Promise<void> {
  const { tenantId, companyName, daysUntil, recipientIds } = params;
  const isExpired = daysUntil === 0;

  const title = isExpired
    ? `Lead has expired: ${companyName}`
    : `Lead expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}: ${companyName}`;

  const body = isExpired
    ? `${companyName} has passed its expiry date.`
    : `${companyName} will expire in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`;

  const type = isExpired ? 'lead_expired' : 'lead_expiry_reminder';

  for (const userId of recipientIds) {
    await notify({ tenantId, userId, type, title, body, link: '/leads' });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/notificationService.ts
git commit -m "feat: add notifyLeadExpiryReminder to notificationService"
```

---

## Task 6: Scheduler Extension

**Files:**
- Modify: `backend/src/scheduler.ts`

- [ ] **Step 1: Add the `checkLeadExpiry` function and schedule it**

Replace the full content of `backend/src/scheduler.ts` with:

```typescript
import cron from 'node-cron';
import { findTasksDueToday, findOverdueTasks } from './models/taskModel';
import { getLeadsWithPendingReminders, markReminderSent } from './models/leadExpiryModel';
import { findAdminsByTenant } from './models/userModel';
import {
  notifyTaskDueToday,
  notifyTaskOverdue,
  notifyLeadExpiryReminder,
} from './services/notificationService';

async function checkTaskNotifications(): Promise<void> {
  try {
    const dueTasks = await findTasksDueToday();
    for (const task of dueTasks) {
      notifyTaskDueToday({
        tenantId:   task.tenantId,
        assigneeId: task.ownerId,
        taskTitle:  task.title,
      });
    }
    console.log(`[Scheduler] Sent ${dueTasks.length} due-today notifications`);
  } catch (err) {
    console.error('[Scheduler] Error processing due-today tasks:', err);
  }

  try {
    const overdueTasks = await findOverdueTasks();
    for (const task of overdueTasks) {
      notifyTaskOverdue({
        tenantId:   task.tenantId,
        assigneeId: task.ownerId,
        taskTitle:  task.title,
        dueDate:    task.dueDate,
      });
    }
    console.log(`[Scheduler] Sent ${overdueTasks.length} overdue notifications`);
  } catch (err) {
    console.error('[Scheduler] Error processing overdue tasks:', err);
  }
}

async function checkLeadExpiry(): Promise<void> {
  try {
    const rows = await getLeadsWithPendingReminders();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let sent = 0;

    for (const row of rows) {
      const expiry = new Date(row.expiryDate);
      expiry.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((expiry.getTime() - today.getTime()) / 86_400_000);

      const interval =
        daysUntil === 7 && !row.notified7d      ? '7d'      :
        daysUntil === 5 && !row.notified5d      ? '5d'      :
        daysUntil === 2 && !row.notified2d      ? '2d'      :
        daysUntil === 1 && !row.notified1d      ? '1d'      :
        daysUntil === 0 && !row.notifiedExpired ? 'expired' :
        null;

      if (!interval) continue;

      const admins = await findAdminsByTenant(row.tenantId);
      const recipientIds = [...new Set([row.ownerId, ...admins.map(a => a.id)])];

      await notifyLeadExpiryReminder({
        tenantId:     row.tenantId,
        companyName:  row.companyName,
        daysUntil:    interval === 'expired' ? 0 : parseInt(interval),
        recipientIds,
      });

      await markReminderSent(row.leadId, interval as '7d' | '5d' | '2d' | '1d' | 'expired');
      sent++;
    }

    console.log(`[Scheduler] Sent ${sent} lead expiry reminder notifications`);
  } catch (err) {
    console.error('[Scheduler] Error processing lead expiry reminders:', err);
  }
}

export function startScheduler(): void {
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Running daily jobs');
    await checkTaskNotifications();
    await checkLeadExpiry();
  });

  console.log('[Scheduler] Daily jobs scheduled (08:00)');
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scheduler.ts
git commit -m "feat: add checkLeadExpiry job to daily scheduler"
```

---

## Task 7: Frontend Service + `useLeadExpiry` Hook

**Files:**
- Create: `frontend/src/services/leadExpiryService.ts`
- Create: `frontend/src/hooks/useLeadExpiry.ts`

- [ ] **Step 1: Create `leadExpiryService.ts`**

```typescript
// frontend/src/services/leadExpiryService.ts
import { apiFetch } from '@/config/api'

export interface LeadExpiry {
  id:         string
  leadId:     string
  expiryDate: string   // "YYYY-MM-DD"
  setBy:      string
  createdAt:  string
  updatedAt:  string
}

export interface ExpiryInfo {
  expiryDate: string
  daysUntil:  number
}

export const getLeadExpiry = (leadId: string) =>
  apiFetch<LeadExpiry | null>(`/api/leads/${leadId}/expiry`)

export const getBulkLeadExpiry = () =>
  apiFetch<Record<string, ExpiryInfo>>('/api/leads/expiry/bulk')

export const setLeadExpiry = (leadId: string, expiryDate: string) =>
  apiFetch<LeadExpiry>(`/api/leads/${leadId}/expiry`, {
    method: 'PUT',
    body:   JSON.stringify({ expiryDate }),
  })

export const deleteLeadExpiry = (leadId: string) =>
  apiFetch<void>(`/api/leads/${leadId}/expiry`, { method: 'DELETE' })
```

- [ ] **Step 2: Create `useLeadExpiry.ts`**

```typescript
// frontend/src/hooks/useLeadExpiry.ts
import { useState, useEffect, useCallback } from 'react'
import { getBulkLeadExpiry, ExpiryInfo } from '@/services/leadExpiryService'

export function useLeadExpiry() {
  const [expiryMap, setExpiryMap] = useState<Record<string, ExpiryInfo>>({})
  const [isLoading, setIsLoading] = useState(false)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getBulkLeadExpiry()
      setExpiryMap(data)
    } catch {
      // Expiry is supplementary — silently fail, don't break the page
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return { expiryMap, isLoading, refetch }
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/leadExpiryService.ts frontend/src/hooks/useLeadExpiry.ts
git commit -m "feat: add leadExpiryService and useLeadExpiry hook"
```

---

## Task 8: `ExpiryBadge` Component

**Files:**
- Create: `frontend/src/components/leads/ExpiryBadge.tsx`

A small read-only coloured chip used on Kanban cards and the Leads list. `LeadExpiryPanel` also uses it internally.

- [ ] **Step 1: Create `ExpiryBadge.tsx`**

```typescript
// frontend/src/components/leads/ExpiryBadge.tsx
import { cn } from '@/lib/utils/cn'

interface Props {
  daysUntil: number | null   // null = no expiry set
  className?: string
}

export function ExpiryBadge({ daysUntil, className }: Props) {
  if (daysUntil === null) {
    return (
      <span className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] md:text-xs',
        'bg-muted text-muted-foreground',
        className
      )}>
        No expiry
      </span>
    )
  }

  const { label, style } = getExpiryDisplay(daysUntil)

  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] md:text-xs font-medium',
      style,
      className
    )}>
      {label}
    </span>
  )
}

export function getExpiryDisplay(daysUntil: number): { label: string; style: string } {
  if (daysUntil > 7) {
    return {
      label: `Expires in ${daysUntil}d`,
      style: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    }
  }
  if (daysUntil >= 3) {
    return {
      label: `Expires in ${daysUntil}d`,
      style: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    }
  }
  if (daysUntil >= 1) {
    return {
      label: `Expires in ${daysUntil}d`,
      style: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    }
  }
  if (daysUntil === 0) {
    return {
      label: 'Expires today',
      style: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }
  }
  // daysUntil < 0
  const ago = Math.abs(daysUntil)
  return {
    label: `Expired ${ago}d ago`,
    style: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/leads/ExpiryBadge.tsx
git commit -m "feat: add ExpiryBadge component"
```

---

## Task 9: `LeadExpiryPanel` Component

**Files:**
- Create: `frontend/src/components/leads/LeadExpiryPanel.tsx`

Full editor used inside `DealModal`. Shows "Open for X days", the expiry badge, a date picker, and save/remove buttons. Read-only for users who are neither admin nor the lead owner.

- [ ] **Step 1: Create `LeadExpiryPanel.tsx`**

```typescript
// frontend/src/components/leads/LeadExpiryPanel.tsx
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ExpiryBadge } from './ExpiryBadge'
import { getLeadExpiry, setLeadExpiry, deleteLeadExpiry, LeadExpiry } from '@/services/leadExpiryService'
import { useIsAdmin } from '@/store/authStore'
import { useAuthStore } from '@/store/authStore'

interface Props {
  leadId:    string
  ownerId:   string
  createdAt: string   // ISO date string — used for "Open for X days"
  onChanged?: () => void
}

function daysOpen(createdAt: string): number {
  const created = new Date(createdAt)
  created.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((today.getTime() - created.getTime()) / 86_400_000))
}

function daysUntil(expiryDate: string): number {
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000)
}

export function LeadExpiryPanel({ leadId, ownerId, createdAt, onChanged }: Props) {
  const isAdmin       = useIsAdmin()
  const { userProfile } = useAuthStore()
  const isOwner       = userProfile?.id === ownerId
  const canEdit       = isAdmin || isOwner

  const [expiry,    setExpiry]    = useState<LeadExpiry | null>(null)
  const [dateInput, setDateInput] = useState('')
  const [isSaving,  setIsSaving]  = useState(false)

  useEffect(() => {
    getLeadExpiry(leadId)
      .then(data => {
        setExpiry(data)
        setDateInput(data?.expiryDate ?? '')
      })
      .catch(() => {}) // silently fail — expiry is supplementary
  }, [leadId])

  const handleSave = async () => {
    if (!dateInput) return
    setIsSaving(true)
    try {
      const updated = await setLeadExpiry(leadId, dateInput)
      setExpiry(updated)
      toast.success('Expiry date saved')
      onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save expiry date')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async () => {
    setIsSaving(true)
    try {
      await deleteLeadExpiry(leadId)
      setExpiry(null)
      setDateInput('')
      toast.success('Expiry date removed')
      onChanged?.()
    } catch {
      toast.error('Failed to remove expiry date')
    } finally {
      setIsSaving(false)
    }
  }

  const currentDaysUntil = expiry ? daysUntil(expiry.expiryDate) : null
  const openDays         = daysOpen(createdAt)

  return (
    <div className="space-y-3">
      {/* Timeline */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarClock className="h-4 w-4 flex-shrink-0" />
        <span>Open for <strong>{openDays}</strong> day{openDays === 1 ? '' : 's'}</span>
        {currentDaysUntil !== null && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <ExpiryBadge daysUntil={currentDaysUntil} />
          </>
        )}
      </div>

      {/* Editor — only for admin or owner */}
      {canEdit && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Expiry Date
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateInput}
              onChange={e => setDateInput(e.target.value)}
              min={new Date(Date.now() + 86_400_000).toISOString().split('T')[0]}
              disabled={isSaving}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !dateInput}
            >
              {expiry ? 'Update' : 'Set'}
            </Button>
            {expiry && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRemove}
                disabled={isSaving}
                className="text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Read-only for non-editors when no expiry */}
      {!canEdit && currentDaysUntil === null && (
        <p className="text-xs text-muted-foreground">No expiry date set.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/leads/LeadExpiryPanel.tsx
git commit -m "feat: add LeadExpiryPanel component"
```

---

## Task 10: Wire into `DealModal`

**Files:**
- Modify: `frontend/src/components/kanban/DealModal.tsx`

Add a "Timeline" section below the Owner row. Shows `LeadExpiryPanel` when the modal is open for a lead that has a `createdAt`.

- [ ] **Step 1: Add import to `DealModal.tsx`**

Add to the imports section at the top:
```typescript
import { LeadExpiryPanel } from '@/components/leads/LeadExpiryPanel'
```

- [ ] **Step 2: Add the Timeline section in the form grid**

Find the closing `</div>` of the Owner field section (the `col-span-2` div ending around the `ownerState` block), and add immediately after it, still inside the `grid grid-cols-2 gap-4` div:

```typescript
{/* Timeline & Expiry */}
<div className="space-y-2 col-span-2 border-t pt-4">
  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
    Timeline
  </Label>
  <LeadExpiryPanel
    leadId={lead.id}
    ownerId={ownerState?.ownerId ?? lead.ownerId}
    createdAt={lead.createdAt ?? new Date().toISOString()}
  />
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/kanban/DealModal.tsx
git commit -m "feat: add Timeline section with LeadExpiryPanel to DealModal"
```

---

## Task 11: Wire into `KanbanCard` and `KanbanBoard`

**Files:**
- Modify: `frontend/src/components/kanban/KanbanCard.tsx`
- Modify: `frontend/src/components/kanban/KanbanBoard.tsx`

Add the expiry badge chip to each card. Expiry data is fetched once in `KanbanBoard` via `useLeadExpiry` and passed down as a prop.

- [ ] **Step 1: Update `KanbanCard.tsx` — add `expiryInfo` prop and render badge**

Add to imports:
```typescript
import { ExpiryBadge } from '@/components/leads/ExpiryBadge'
import { ExpiryInfo } from '@/services/leadExpiryService'
```

Add `expiryInfo?: ExpiryInfo` to the `KanbanCardProps` interface:
```typescript
interface KanbanCardProps {
  lead:            Lead
  onClick:         () => void
  onLeadUpdated?:  (updated: { id: string; ownerId: string; ownerEmail: string }) => void
  expiryInfo?:     ExpiryInfo   // ← add this
}
```

In the card body, after the owner chip `<div>` (the `onClick={e => e.stopPropagation()}` section), add the expiry badge:

```typescript
{expiryInfo !== undefined && (
  <div className="mt-1 flex">
    <ExpiryBadge daysUntil={expiryInfo.daysUntil} />
  </div>
)}
```

- [ ] **Step 2: Update `KanbanBoard.tsx` — fetch expiry and pass to cards**

Add to imports:
```typescript
import { useLeadExpiry } from '@/hooks/useLeadExpiry'
```

Add hook call in the component body (after `const getDefaultProbability = ...`):
```typescript
const { expiryMap } = useLeadExpiry()
```

Find where `<KanbanCard>` is rendered inside `<KanbanColumn>` (passed via `renderCard` or inline). Pass `expiryInfo`:

In the `<KanbanColumn>` render, pass `expiryMap` as a prop:
```typescript
<KanbanColumn
  ...
  expiryMap={expiryMap}
  ...
/>
```

Add `expiryMap` to `KanbanColumnProps`:
```typescript
expiryMap: Record<string, { expiryDate: string; daysUntil: number }>
```

In `KanbanColumn.tsx`, pass `expiryInfo` to each `<KanbanCard>`:
```typescript
<KanbanCard
  ...
  expiryInfo={expiryMap[lead.id]}
  ...
/>
```

Also thread `expiryMap` through the `<KanbanCard>` inside `<DragOverlay>` in `KanbanBoard.tsx`:
```typescript
<KanbanCard
  lead={activeLead}
  onClick={() => {}}
  expiryInfo={expiryMap[activeLead.id]}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/kanban/KanbanCard.tsx \
        frontend/src/components/kanban/KanbanBoard.tsx \
        frontend/src/components/kanban/KanbanColumn.tsx
git commit -m "feat: add expiry badge to KanbanCard via KanbanBoard expiryMap"
```

---

## Task 12: Wire into `LeadsPage`

**Files:**
- Modify: `frontend/src/pages/shared/LeadsPage.tsx`

Add the expiry badge chip to each lead card in the grid view. Uses the same `useLeadExpiry` hook.

- [ ] **Step 1: Add imports to `LeadsPage.tsx`**

```typescript
import { ExpiryBadge } from '@/components/leads/ExpiryBadge'
import { useLeadExpiry } from '@/hooks/useLeadExpiry'
```

- [ ] **Step 2: Add hook call**

Add after the existing hook calls at the top of the component:
```typescript
const { expiryMap } = useLeadExpiry()
```

- [ ] **Step 3: Add expiry badge to each lead card**

Find where each lead card is rendered (the `.map(lead => ...)` loop). Add the expiry badge in the owner field section (after the owner `<div onClick={e => e.stopPropagation()}>` block):

```typescript
{expiryMap[lead.id] !== undefined && (
  <div className="mt-1.5">
    <ExpiryBadge daysUntil={expiryMap[lead.id].daysUntil} />
  </div>
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/shared/LeadsPage.tsx
git commit -m "feat: add expiry badge to LeadsPage lead cards"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `lead_expiry` table — Task 1
- ✅ `upsertExpiry` resets flags — Task 2
- ✅ `findAdminsByTenant` — Task 3
- ✅ 4 API endpoints including bulk — Task 4
- ✅ Auth: admin or lead owner only for set/delete — Task 4
- ✅ 400 if expiryDate in the past — Task 4
- ✅ `notifyLeadExpiryReminder` with `lead_expired` / `lead_expiry_reminder` types — Task 5
- ✅ Scheduler: 7d/5d/2d/1d/expired intervals — Task 6
- ✅ Scheduler sends to owner + all admins, deduplicated — Task 6
- ✅ `ExpiryBadge` with 6 colour states — Task 8
- ✅ `LeadExpiryPanel` with "Open for X days" timeline — Task 9
- ✅ DealModal wired — Task 10
- ✅ KanbanCard wired via KanbanBoard expiryMap — Task 11
- ✅ LeadsPage wired — Task 12

**Type consistency:**
- `ExpiryInfo` defined in `leadExpiryService.ts`, re-used in `useLeadExpiry`, `KanbanCardProps`, `KanbanColumnProps`, `LeadsPage`
- `daysUntil: number` (not string) everywhere
- `expiryMap: Record<string, ExpiryInfo>` consistent throughout
