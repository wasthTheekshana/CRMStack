# In-App Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real-time in-app notification system — bell icon in the header, 30-second polling, per-user feed with dismiss and mark-all-read, triggered by lead/task/team events.

**Architecture:** A `NotificationService` (service layer) is called fire-and-forget by existing controllers after their primary action succeeds. The model layer owns all DB access. A `node-cron` scheduler fires daily task due/overdue notifications. The frontend polls every 30 s via a Zustand store and renders a bell + popover feed in the header.

**Tech Stack:** Node.js / Express / TypeScript / PostgreSQL (backend); React 18 / Zustand / shadcn/ui Popover / date-fns / lucide-react (frontend); node-cron (scheduler)

---

## File Map

**Create:**
- `backend/migrations/013_notifications.sql`
- `backend/src/models/notificationModel.ts`
- `backend/src/services/notificationService.ts`
- `backend/src/controllers/notificationController.ts`
- `backend/src/routes/notifications.ts`
- `backend/src/scheduler.ts`
- `frontend/src/lib/api/notificationsApi.ts`
- `frontend/src/store/notificationStore.ts`
- `frontend/src/components/notifications/NotificationBell.tsx`
- `frontend/src/components/notifications/NotificationFeed.tsx`

**Modify:**
- `backend/src/models/taskModel.ts` — add `findTasksDueToday`, `findOverdueTasks`
- `backend/src/routes/index.ts` — mount `/notifications`
- `backend/src/index.ts` — start scheduler
- `backend/src/controllers/leadController.ts` — add notification calls
- `backend/src/controllers/taskController.ts` — add notification call
- `backend/src/controllers/userController.ts` — add notification calls
- `frontend/src/components/layout/Header.tsx` — replace placeholder bell
- `frontend/src/components/layout/AppLayout.tsx` — start/stop polling

---

## Task 1: DB Migration

**Files:**
- Create: `backend/migrations/013_notifications.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/migrations/013_notifications.sql
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type         VARCHAR(64)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT         NOT NULL,
  link         VARCHAR(255),
  read_at      TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id  ON notifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
```

- [ ] **Step 2: Run the migration**

```bash
cd "d:/Project/Sale Funnel/backend"
npm run migrate
```

Expected: migration output with no errors. Verify in psql:
```sql
\d notifications
```
Expected: table with columns `id, tenant_id, user_id, type, title, body, link, read_at, dismissed_at, created_at`.

---

## Task 2: Backend Model

**Files:**
- Create: `backend/src/models/notificationModel.ts`
- Modify: `backend/src/models/taskModel.ts`

- [ ] **Step 1: Create `notificationModel.ts`**

```typescript
// backend/src/models/notificationModel.ts
import { query } from '../config/db';

export interface NotificationRow {
  id:         string;
  type:       string;
  title:      string;
  body:       string;
  link:       string | null;
  readAt:     string | null;
  createdAt:  string;
}

const mapRow = (r: Record<string, unknown>): NotificationRow => ({
  id:        r.id          as string,
  type:      r.type        as string,
  title:     r.title       as string,
  body:      r.body        as string,
  link:      (r.link       as string | null) ?? null,
  readAt:    (r.read_at    as string | null) ?? null,
  createdAt: r.created_at  as string,
});

export async function createNotification(params: {
  tenantId: string;
  userId:   string;
  type:     string;
  title:    string;
  body:     string;
  link?:    string;
}): Promise<void> {
  await query(
    `INSERT INTO notifications (tenant_id, user_id, type, title, body, link)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [params.tenantId, params.userId, params.type, params.title, params.body, params.link ?? null]
  );
}

export async function getNotifications(
  userId: string,
  tenantId: string,
  limit = 20
): Promise<NotificationRow[]> {
  const result = await query(
    `SELECT id, type, title, body, link, read_at, created_at
       FROM notifications
      WHERE user_id      = $1
        AND tenant_id    = $2
        AND dismissed_at IS NULL
      ORDER BY
        read_at IS NULL DESC,
        created_at DESC
      LIMIT $3`,
    [userId, tenantId, limit]
  );
  return result.rows.map(mapRow);
}

export async function getUnreadCount(userId: string, tenantId: string): Promise<number> {
  const result = await query(
    `SELECT COUNT(*) FROM notifications
      WHERE user_id = $1 AND tenant_id = $2
        AND read_at IS NULL AND dismissed_at IS NULL`,
    [userId, tenantId]
  );
  return parseInt(result.rows[0].count, 10);
}

export async function markAllRead(userId: string, tenantId: string): Promise<void> {
  await query(
    `UPDATE notifications
        SET read_at = NOW()
      WHERE user_id = $1 AND tenant_id = $2 AND read_at IS NULL`,
    [userId, tenantId]
  );
}

export async function dismissNotification(
  id: string,
  userId: string,
  tenantId: string
): Promise<boolean> {
  const result = await query(
    `UPDATE notifications
        SET dismissed_at = NOW()
      WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
    [id, userId, tenantId]
  );
  return (result.rowCount ?? 0) > 0;
}
```

- [ ] **Step 2: Add task query functions to `taskModel.ts`**

Append to the end of `backend/src/models/taskModel.ts`:

```typescript
export async function findTasksDueToday(): Promise<Array<{
  id: string; title: string; ownerId: string; tenantId: string;
}>> {
  const result = await query(
    `SELECT id, title, owner_id, tenant_id FROM tasks
      WHERE due_date = CURRENT_DATE
        AND status   != 'completed'
        AND tenant_id IS NOT NULL`,
    []
  );
  return result.rows.map((r) => ({
    id:       r.id       as string,
    title:    r.title    as string,
    ownerId:  r.owner_id as string,
    tenantId: r.tenant_id as string,
  }));
}

export async function findOverdueTasks(): Promise<Array<{
  id: string; title: string; ownerId: string; tenantId: string; dueDate: string;
}>> {
  const result = await query(
    `SELECT id, title, owner_id, tenant_id, due_date FROM tasks
      WHERE due_date < CURRENT_DATE
        AND status   != 'completed'
        AND tenant_id IS NOT NULL`,
    []
  );
  return result.rows.map((r) => ({
    id:       r.id        as string,
    title:    r.title     as string,
    ownerId:  r.owner_id  as string,
    tenantId: r.tenant_id as string,
    dueDate:  r.due_date  as string,
  }));
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 3: Backend Service

**Files:**
- Create: `backend/src/services/notificationService.ts`

- [ ] **Step 1: Create `notificationService.ts`**

```typescript
// backend/src/services/notificationService.ts
import { createNotification } from '../models/notificationModel';

async function notify(params: {
  tenantId: string;
  userId:   string;
  type:     string;
  title:    string;
  body:     string;
  link?:    string;
}): Promise<void> {
  try {
    await createNotification(params);
  } catch (err) {
    console.error('[NotificationService] failed to create notification:', err);
  }
}

export async function notifyLeadAssigned(params: {
  tenantId:    string;
  assigneeId:  string;
  actorId:     string;
  companyName: string;
}): Promise<void> {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'lead_assigned',
    title:    'Lead assigned to you',
    body:     `${params.companyName} has been assigned to you.`,
    link:     '/leads',
  });
}

export async function notifyLeadStageChanged(params: {
  tenantId:    string;
  assigneeId:  string;
  actorId:     string;
  companyName: string;
  oldStage:    string;
  newStage:    string;
}): Promise<void> {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'lead_stage_changed',
    title:    'Lead stage updated',
    body:     `${params.companyName} moved from ${params.oldStage} to ${params.newStage}.`,
    link:     '/leads',
  });
}

export async function notifyLeadDeleted(params: {
  tenantId:    string;
  assigneeId:  string;
  actorId:     string;
  companyName: string;
}): Promise<void> {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'lead_deleted',
    title:    'Lead deleted',
    body:     `${params.companyName} has been deleted.`,
    link:     '/leads/deleted',
  });
}

export async function notifyLeadRestored(params: {
  tenantId:    string;
  assigneeId:  string;
  actorId:     string;
  companyName: string;
}): Promise<void> {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'lead_restored',
    title:    'Lead restored',
    body:     `${params.companyName} has been restored.`,
    link:     '/leads',
  });
}

export async function notifyTaskAssigned(params: {
  tenantId:   string;
  assigneeId: string;
  actorId:    string;
  taskTitle:  string;
}): Promise<void> {
  if (params.assigneeId === params.actorId) return;
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'task_assigned',
    title:    'Task assigned to you',
    body:     `Task "${params.taskTitle}" has been assigned to you.`,
    link:     '/tasks',
  });
}

export async function notifyTaskDueToday(params: {
  tenantId:   string;
  assigneeId: string;
  taskTitle:  string;
}): Promise<void> {
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'task_due_today',
    title:    'Task due today',
    body:     `Task "${params.taskTitle}" is due today.`,
    link:     '/tasks',
  });
}

export async function notifyTaskOverdue(params: {
  tenantId:   string;
  assigneeId: string;
  taskTitle:  string;
  dueDate:    string;
}): Promise<void> {
  void notify({
    tenantId: params.tenantId,
    userId:   params.assigneeId,
    type:     'task_overdue',
    title:    'Task overdue',
    body:     `Task "${params.taskTitle}" is overdue (was due ${params.dueDate}).`,
    link:     '/tasks',
  });
}

export async function notifyTeamMemberAdded(params: {
  tenantId:     string;
  adminIds:     string[];
  newUserName:  string;
  newUserEmail: string;
}): Promise<void> {
  for (const adminId of params.adminIds) {
    void notify({
      tenantId: params.tenantId,
      userId:   adminId,
      type:     'team_member_added',
      title:    'New team member',
      body:     `${params.newUserName} (${params.newUserEmail}) has joined your workspace.`,
      link:     '/admin/team',
    });
  }
}

export async function notifyUserDeactivated(params: {
  tenantId: string;
  adminIds: string[];
  userName: string;
}): Promise<void> {
  for (const adminId of params.adminIds) {
    void notify({
      tenantId: params.tenantId,
      userId:   adminId,
      type:     'user_deactivated',
      title:    'User deactivated',
      body:     `${params.userName} has been deactivated.`,
      link:     '/admin/team',
    });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: Backend Controller + Routes

**Files:**
- Create: `backend/src/controllers/notificationController.ts`
- Create: `backend/src/routes/notifications.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create `notificationController.ts`**

```typescript
// backend/src/controllers/notificationController.ts
import { Request, Response } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  dismissNotification,
} from '../models/notificationModel';

export async function listNotifications(req: Request, res: Response) {
  try {
    const userId   = req.user!.userId;
    const tenantId = req.user!.tenantId;
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(userId, tenantId, 20),
      getUnreadCount(userId, tenantId),
    ]);
    res.json({ unreadCount, notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function markAllReadHandler(req: Request, res: Response) {
  try {
    await markAllRead(req.user!.userId, req.user!.tenantId);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

export async function dismissNotificationHandler(req: Request, res: Response) {
  try {
    const found = await dismissNotification(
      req.params.id,
      req.user!.userId,
      req.user!.tenantId
    );
    if (!found) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json({ message: 'Notification dismissed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 2: Create `notifications.ts` route**

```typescript
// backend/src/routes/notifications.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listNotifications,
  markAllReadHandler,
  dismissNotificationHandler,
} from '../controllers/notificationController';

const router = Router();

router.get('/',               requireAuth, listNotifications);
router.post('/mark-all-read', requireAuth, markAllReadHandler);
router.delete('/:id',         requireAuth, dismissNotificationHandler);

export default router;
```

- [ ] **Step 3: Mount in `routes/index.ts`**

Add to `backend/src/routes/index.ts`:

```typescript
import notificationRoutes from './notifications';
```

And add one line in the router block:

```typescript
router.use('/notifications', notificationRoutes);
```

Full updated `index.ts`:

```typescript
import { Router } from 'express';
import authRoutes          from './auth';
import userRoutes          from './users';
import leadRoutes          from './leads';
import taskRoutes          from './tasks';
import activityRoutes      from './activities';
import salesTargetRoutes   from './salesTargets';
import settingsRoutes      from './settings';
import kpiRoutes           from './kpis';
import tenantRoutes        from './tenants';
import tenantConfigRoutes  from './tenantConfig';
import superAdminRoutes    from './superAdmin';
import notificationRoutes  from './notifications';

const router = Router();

router.use('/auth',          authRoutes);
router.use('/users',         userRoutes);
router.use('/leads',         leadRoutes);
router.use('/tasks',         taskRoutes);
router.use('/activities',    activityRoutes);
router.use('/sales-targets', salesTargetRoutes);
router.use('/settings',      settingsRoutes);
router.use('/kpis',          kpiRoutes);
router.use('/tenants',       tenantRoutes);
router.use('/tenant/config', tenantConfigRoutes);
router.use('/super-admin',   superAdminRoutes);
router.use('/notifications', notificationRoutes);

export default router;
```

- [ ] **Step 4: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Start the backend: `npm run dev`

```bash
# Get a JWT token first via login, then:
curl -s -X GET http://localhost:4000/api/notifications \
  -H "Authorization: Bearer <your-token>"
```

Expected: `{"unreadCount":0,"notifications":[]}`

---

## Task 5: Scheduler

**Files:**
- Create: `backend/src/scheduler.ts`
- Modify: `backend/src/index.ts`

- [ ] **Step 1: Install node-cron**

```bash
cd "d:/Project/Sale Funnel/backend"
npm install node-cron
npm install --save-dev @types/node-cron
```

Expected: packages added to `package.json`.

- [ ] **Step 2: Create `scheduler.ts`**

```typescript
// backend/src/scheduler.ts
import cron from 'node-cron';
import { findTasksDueToday, findOverdueTasks } from './models/taskModel';
import {
  notifyTaskDueToday,
  notifyTaskOverdue,
} from './services/notificationService';

export function startScheduler(): void {
  // Daily at 08:00 server time
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Running daily task notification job');

    try {
      const dueTasks = await findTasksDueToday();
      for (const task of dueTasks) {
        await notifyTaskDueToday({
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
        await notifyTaskOverdue({
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
  });

  console.log('[Scheduler] Daily task notification job scheduled (08:00)');
}
```

- [ ] **Step 3: Start scheduler in `index.ts`**

```typescript
// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/index';
import { startScheduler } from './scheduler';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', db: 'postgresql' }));
app.use('/api', apiRoutes);

startScheduler();

app.listen(PORT, () => {
  console.log(`\n  DOK CRM Backend running on http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health\n`);
});
```

- [ ] **Step 4: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: Wire Lead Controller

**Files:**
- Modify: `backend/src/controllers/leadController.ts`

Context: `leadController.ts` has four handlers to touch: `createLeadHandler`, `updateLeadHandler`, `deleteLeadHandler`, `restoreLeadHandler`.

For `updateLeadHandler`, we need the existing lead's `ownerId` and `salesStage` before the update to detect changes. We'll use `findLeadById` for this (which is already imported).

- [ ] **Step 1: Add service import to `leadController.ts`**

At the top of `backend/src/controllers/leadController.ts`, add:

```typescript
import {
  notifyLeadAssigned,
  notifyLeadStageChanged,
  notifyLeadDeleted,
  notifyLeadRestored,
} from '../services/notificationService';
```

- [ ] **Step 2: Add notification to `createLeadHandler`**

After `res.status(201).json(lead);`, add — but the notification must go BEFORE the response line. Replace the try block's success path:

```typescript
  try {
    const lead = await createLead({
      companyName, solution,
      contacts:         contacts || [],
      salesStage,
      imageCount:       imageCount || 0,
      boxCount:         boxCount || 0,
      estimatedRevenue: estimatedRevenue || 0,
      probability:      probability || 0,
      remarks:          remarks || '',
      hoUpdate:         hoUpdate || '',
      position:         position || null,
      ownerId:          actualOwnerId,
      ownerEmail:       actualOwnerEmail,
      tenantId:         req.user!.tenantId,
      customFields:     customFields || {},
    });
    void notifyLeadAssigned({
      tenantId:    req.user!.tenantId,
      assigneeId:  lead.ownerId as string,
      actorId:     req.user!.userId,
      companyName: lead.companyName as string,
    });
    res.status(201).json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
```

- [ ] **Step 3: Add notification to `updateLeadHandler`**

Replace the full `updateLeadHandler` function:

```typescript
export async function updateLeadHandler(req: Request, res: Response) {
  const {
    companyName, solution, contacts, salesStage,
    imageCount, boxCount, estimatedRevenue, probability,
    remarks, hoUpdate, position, ownerId, ownerEmail, customFields,
  } = req.body;

  try {
    const existingLead = await findLeadById(req.params.id, req.user!.tenantId);
    if (!existingLead) { res.status(404).json({ error: 'Lead not found' }); return; }

    if (req.user!.role === 'sales' && existingLead.ownerId !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' }); return;
    }

    const lead = await updateLead(req.params.id, req.user!.tenantId, {
      companyName, solution, contacts, salesStage,
      imageCount, boxCount, estimatedRevenue, probability,
      remarks, hoUpdate, position, ownerId, ownerEmail, customFields,
    });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }

    const newOwnerId   = lead.ownerId   as string;
    const newStage     = lead.salesStage as string;
    const oldOwnerId   = existingLead.ownerId   as string;
    const oldStage     = existingLead.salesStage as string;

    if (newOwnerId && newOwnerId !== oldOwnerId) {
      void notifyLeadAssigned({
        tenantId:    req.user!.tenantId,
        assigneeId:  newOwnerId,
        actorId:     req.user!.userId,
        companyName: lead.companyName as string,
      });
    }
    if (newStage && newStage !== oldStage) {
      void notifyLeadStageChanged({
        tenantId:    req.user!.tenantId,
        assigneeId:  newOwnerId,
        actorId:     req.user!.userId,
        companyName: lead.companyName as string,
        oldStage,
        newStage,
      });
    }

    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 4: Add notification to `deleteLeadHandler`**

Replace the full `deleteLeadHandler`:

```typescript
export async function deleteLeadHandler(req: Request, res: Response) {
  try {
    if (req.user!.role === 'sales') {
      const existingOwnerId = await getLeadOwnerId(req.params.id, req.user!.tenantId);
      if (existingOwnerId !== req.user!.userId) { res.status(403).json({ error: 'Access denied' }); return; }
    }
    const existingLead = await findLeadById(req.params.id, req.user!.tenantId);
    await softDeleteLead(req.params.id, req.user!.tenantId);
    if (existingLead) {
      void notifyLeadDeleted({
        tenantId:    req.user!.tenantId,
        assigneeId:  existingLead.ownerId as string,
        actorId:     req.user!.userId,
        companyName: existingLead.companyName as string,
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 5: Add notification to `restoreLeadHandler`**

Replace the full `restoreLeadHandler`:

```typescript
export async function restoreLeadHandler(req: Request, res: Response) {
  try {
    const lead = await restoreLead(req.params.id, req.user!.tenantId);
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    void notifyLeadRestored({
      tenantId:    req.user!.tenantId,
      assigneeId:  lead.ownerId as string,
      actorId:     req.user!.userId,
      companyName: lead.companyName as string,
    });
    res.json(lead);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 7: Wire Task + User Controllers

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/controllers/userController.ts`

> **Note on task assignment:** The current task model assigns tasks to `req.user!.userId` (the creator). Since creator === assignee, the self-notification guard in `notifyTaskAssigned` will always skip it. This is correct behaviour — the wiring is still included so it works automatically when task reassignment is added later.

- [ ] **Step 1: Add import + notification to `taskController.ts`**

Add import at the top:

```typescript
import { notifyTaskAssigned } from '../services/notificationService';
```

Replace `createTaskHandler`:

```typescript
export async function createTaskHandler(req: Request, res: Response) {
  const { leadId, title, description, type, dueDate, priority } = req.body;
  if (!title || !type || !dueDate) {
    res.status(400).json({ error: 'title, type, dueDate required' });
    return;
  }
  try {
    const task = await createTask({
      leadId:      leadId || null,
      title,
      description: description || '',
      type,
      dueDate,
      priority:    priority || 'medium',
      ownerId:     req.user!.userId,
      tenantId:    req.user!.tenantId,
    });
    void notifyTaskAssigned({
      tenantId:   req.user!.tenantId,
      assigneeId: task.ownerId as string,
      actorId:    req.user!.userId,
      taskTitle:  task.title as string,
    });
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 2: Add imports + notifications to `userController.ts`**

Add import at the top of `backend/src/controllers/userController.ts`:

```typescript
import { query } from '../config/db';
import {
  notifyTeamMemberAdded,
  notifyUserDeactivated,
} from '../services/notificationService';
```

> `userController.ts` currently imports `import { pool } from '../config/db'`. Extend it to also import `query`: change that line to `import { pool, query } from '../config/db';`

- [ ] **Step 3: Add admin ID lookup helper and notification to `createUserHandler`**

In `createUserHandler`, after the `COMMIT` and before `res.json(...)`, fetch admin IDs and fire the notification. Find this block in `createUserHandler`:

```typescript
    await client.query('COMMIT');
    res.json(mapUser(result.rows[0]));
```

Replace with:

```typescript
    const createdUser = mapUser(result.rows[0]);
    await client.query('COMMIT');

    const adminResult = await query(
      `SELECT id FROM users WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE`,
      [req.user!.tenantId]
    );
    const adminIds = adminResult.rows.map((r: { id: string }) => r.id);
    void notifyTeamMemberAdded({
      tenantId:     req.user!.tenantId,
      adminIds,
      newUserName:  createdUser.displayName as string,
      newUserEmail: createdUser.email as string,
    });

    res.json(createdUser);
```

- [ ] **Step 4: Add notification to `updateUserHandler` on deactivation**

In `updateUserHandler`, find:

```typescript
    await client.query('COMMIT');
    res.json(mapUser(updateResult.rows[0]));
```

Replace with:

```typescript
    const updatedUser = mapUser(updateResult.rows[0]);
    await client.query('COMMIT');

    if (isActive === false && targetUser.is_active === true) {
      const adminResult = await query(
        `SELECT id FROM users WHERE tenant_id = $1 AND role = 'admin' AND is_active = TRUE`,
        [req.user!.tenantId]
      );
      const adminIds = adminResult.rows.map((r: { id: string }) => r.id);
      void notifyUserDeactivated({
        tenantId: req.user!.tenantId,
        adminIds,
        userName: updatedUser.displayName as string,
      });
    }

    res.json(updatedUser);
```

- [ ] **Step 5: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 8: Frontend API + Store

**Files:**
- Create: `frontend/src/lib/api/notificationsApi.ts`
- Create: `frontend/src/store/notificationStore.ts`

- [ ] **Step 1: Create `notificationsApi.ts`**

```typescript
// frontend/src/lib/api/notificationsApi.ts
import { apiFetch } from '@/config/api';

export interface Notification {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  link:      string | null;
  readAt:    string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  unreadCount:   number;
  notifications: Notification[];
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  return apiFetch<NotificationsResponse>('/api/notifications');
}

export async function markAllRead(): Promise<void> {
  await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
}

export async function dismissNotification(id: string): Promise<void> {
  await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 2: Create `notificationStore.ts`**

```typescript
// frontend/src/store/notificationStore.ts
import { create } from 'zustand';
import {
  fetchNotifications,
  markAllRead,
  dismissNotification,
  Notification,
} from '@/lib/api/notificationsApi';

interface NotificationState {
  notifications: Notification[];
  unreadCount:   number;
  fetchNotifications: () => Promise<void>;
  markAllRead:        () => Promise<void>;
  dismiss:            (id: string) => Promise<void>;
  startPolling:       () => void;
  stopPolling:        () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount:   0,

  fetchNotifications: async () => {
    try {
      const data = await fetchNotifications();
      set({ notifications: data.notifications, unreadCount: data.unreadCount });
    } catch {
      // silent — polling failures should not disrupt the UI
    }
  },

  markAllRead: async () => {
    await markAllRead();
    set((state) => ({
      unreadCount:   0,
      notifications: state.notifications.map((n) => ({
        ...n,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
    }));
  },

  dismiss: async (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: Math.max(
        0,
        state.unreadCount -
          (state.notifications.find((n) => n.id === id)?.readAt === null ? 1 : 0)
      ),
    }));
    await dismissNotification(id);
  },

  startPolling: () => {
    get().fetchNotifications();
    pollingInterval = setInterval(() => {
      get().fetchNotifications();
    }, 30_000);
  },

  stopPolling: () => {
    if (pollingInterval !== null) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },
}));
```

- [ ] **Step 3: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 9: Frontend Components

**Files:**
- Create: `frontend/src/components/notifications/NotificationBell.tsx`
- Create: `frontend/src/components/notifications/NotificationFeed.tsx`

- [ ] **Step 1: Install shadcn Popover component**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx shadcn@latest add popover
```

Expected: `frontend/src/components/ui/popover.tsx` created.

- [ ] **Step 2: Create `NotificationFeed.tsx`**

```tsx
// frontend/src/components/notifications/NotificationFeed.tsx
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNotificationStore } from '@/store/notificationStore'

export function NotificationFeed() {
  const { notifications, unreadCount, markAllRead, dismiss } = useNotificationStore()
  const navigate = useNavigate()

  const handleRowClick = (id: string, link: string | null) => {
    if (link) navigate(link)
  }

  return (
    <div className="w-80 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="font-semibold text-sm">Notifications</span>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="overflow-y-auto max-h-96">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`relative flex gap-3 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                n.readAt === null ? 'border-l-2 border-l-primary bg-primary/5' : ''
              }`}
              onClick={() => handleRowClick(n.id, n.link)}
            >
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${n.readAt === null ? 'font-semibold' : 'font-medium'}`}>
                  {n.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
              <button
                className="flex-shrink-0 text-muted-foreground hover:text-foreground mt-0.5"
                onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `NotificationBell.tsx`**

```tsx
// frontend/src/components/notifications/NotificationBell.tsx
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useNotificationStore } from '@/store/notificationStore'
import { NotificationFeed } from './NotificationFeed'

export function NotificationBell() {
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-10 md:w-10">
          <Bell className="h-4 w-4 md:h-5 md:w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto" align="end">
        <NotificationFeed />
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 10: Frontend Wiring

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`
- Modify: `frontend/src/components/layout/AppLayout.tsx`

- [ ] **Step 1: Replace placeholder bell in `Header.tsx`**

The current `Header.tsx` has a hardcoded placeholder bell button (lines 62–67). Replace it with `<NotificationBell />`.

Add import at the top:

```typescript
import { NotificationBell } from '@/components/notifications/NotificationBell'
```

Remove the entire placeholder block:

```tsx
{/* Notifications placeholder */}
<Button variant="ghost" size="icon" className="relative h-9 w-9 md:h-10 md:w-10">
  <Bell className="h-4 w-4 md:h-5 md:w-5" />
  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
    3
  </span>
</Button>
```

Replace with:

```tsx
<NotificationBell />
```

Also remove `Bell` from the lucide-react import (it's no longer used directly in Header — unless other icons still need it; check the import line and keep only what's used: `LogOut, User, Menu, Settings, Key`).

Updated import line:

```typescript
import { LogOut, User, Menu, Settings, Key } from 'lucide-react'
```

- [ ] **Step 2: Start/stop polling in `AppLayout.tsx`**

Add import at the top:

```typescript
import { useNotificationStore } from '@/store/notificationStore'
```

Inside `AppLayout`, add a polling `useEffect` after the existing `useEffect` blocks:

```typescript
const { startPolling, stopPolling } = useNotificationStore()

useEffect(() => {
  startPolling()
  return () => stopPolling()
}, [startPolling, stopPolling])
```

- [ ] **Step 3: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 11: Smoke Test

**Prerequisites:** PostgreSQL running, migration applied, backend running on port 4000, frontend running on port 5173.

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd "d:/Project/Sale Funnel/backend" && npm run dev

# Terminal 2
cd "d:/Project/Sale Funnel/frontend" && npm run dev
```

- [ ] **Step 2: Verify bell renders with zero count**

Open `http://localhost:5173`, log in. The header should show a bell icon with **no badge**. Click it — the popover should open with "No notifications".

- [ ] **Step 3: Trigger a lead assignment notification**

Log in as Admin A in one browser. Log in as Sales User B in another browser (or incognito).

As Admin A: create a new lead and assign it to Sales User B.

As Sales User B: within 30 seconds, the bell badge should show **1**. Click the bell — verify notification reads "Lead assigned to you" with the company name.

- [ ] **Step 4: Test mark all as read**

Click "Mark all as read" in the feed. Badge should disappear. Reopen the feed — notification row should have no blue left border.

- [ ] **Step 5: Test dismiss**

Click the × on the notification. It should disappear from the feed immediately (optimistic removal).

- [ ] **Step 6: Verify team notifications**

As Admin A: create a new user. Within 30 seconds, all other admins should receive a "New team member" notification.

- [ ] **Step 7: Verify self-notification guard**

As Admin A: create a lead and assign it to yourself. After 30 seconds, confirm **no notification** appears for Admin A.
