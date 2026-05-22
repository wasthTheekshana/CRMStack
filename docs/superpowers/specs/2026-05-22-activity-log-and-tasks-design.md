# Activity Log & Follow-up Tasks — Design Spec

**Date:** 2026-05-22  
**Status:** Approved  

---

## Goal

Add an Activity Log and Follow-up Tasks panel to the lead detail modal so sales reps can track every interaction with a lead and never miss a follow-up.

---

## Decisions

| Question | Decision |
|---|---|
| Where does the UI live? | New "Activity & Tasks" tab inside DealModal |
| Tab structure | Details tab + Activity & Tasks tab (combined) |
| Task assignment | Self only — tasks always belong to the person who created them |
| Stage change logging | Automatic — logged whenever a lead's stage changes |
| Overdue notifications | Yes — existing notification system, daily scheduler job |

---

## Database

Both tables already exist. Migration `018` adds `tenant_id` to both.

### Migration 018

```sql
ALTER TABLE tasks      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id      ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activities_tenant_id ON activities(tenant_id);

UPDATE tasks      SET tenant_id = owner_id WHERE tenant_id IS NULL;
UPDATE activities SET tenant_id = owner_id WHERE tenant_id IS NULL;
```

> Note: the UPDATE above is a best-effort backfill for any existing dev data. On a clean production DB both tables are empty so it is a no-op.

### Existing activities table (no changes to columns)

```
id, lead_id, type (note|stage_change|call|email|meeting),
description, metadata (JSONB), owner_id, created_at, tenant_id
```

### Existing tasks table (no changes to columns)

```
id, lead_id, title, description, type (call|email|meeting|follow-up|other),
due_date, status (pending|completed|overdue), priority (low|medium|high),
owner_id, created_at, completed_at, tenant_id
```

---

## Backend

### New files

**`backend/src/controllers/activityController.ts`**

- `getActivities(req, res)` — `GET /api/activities/:leadId`
  - Verify lead belongs to `req.tenant.id`
  - Return all activities for the lead ordered by `created_at DESC`
- `createActivity(req, res)` — `POST /api/activities/:leadId`
  - Accepts: `{ type, description }`
  - `type` must be one of: `note`, `call`, `email`, `meeting` (not `stage_change` — that is internal only)
  - Sets `owner_id = req.user.id`, `tenant_id = req.tenant.id`

**`backend/src/controllers/taskController.ts`**

- `getTasks(req, res)` — `GET /api/tasks/:leadId`
  - Verify lead belongs to `req.tenant.id`
  - Return all tasks for the lead ordered by `due_date ASC`
- `createTask(req, res)` — `POST /api/tasks/:leadId`
  - Accepts: `{ title, type, due_date, description?, priority? }`
  - Sets `owner_id = req.user.id`, `tenant_id = req.tenant.id`, `status = 'pending'`
- `completeTask(req, res)` — `PATCH /api/tasks/:taskId/complete`
  - Verify `owner_id = req.user.id`
  - Set `status = 'completed'`, `completed_at = NOW()`
- `deleteTask(req, res)` — `DELETE /api/tasks/:taskId`
  - Verify `owner_id = req.user.id`

**`backend/src/routes/activities.ts`**

```
router.get('/:leadId',  authenticate, resolveTenant, getActivities)
router.post('/:leadId', authenticate, resolveTenant, createActivity)
```

**`backend/src/routes/tasks.ts`**

```
router.get('/:leadId',          authenticate, resolveTenant, getTasks)
router.post('/:leadId',         authenticate, resolveTenant, createTask)
router.patch('/:taskId/complete', authenticate, resolveTenant, completeTask)
router.delete('/:taskId',       authenticate, resolveTenant, deleteTask)
```

### Modified files

**`backend/src/controllers/leadController.ts`**  
In the `updateLead` handler, after a successful save, check if `salesStage` changed. If it did, insert a row into `activities`:

```typescript
if (existingLead.salesStage !== newSalesStage) {
  await createActivityInternal({
    leadId:      lead.id,
    tenantId:    req.tenant.id,
    ownerId:     req.user.id,
    type:        'stage_change',
    description: `Stage changed: ${existingLead.salesStage} → ${newSalesStage}`,
  })
}
```

`createActivityInternal` is a plain model function (not an HTTP handler) shared between the controller and the auto-log path.

**`backend/src/scheduler.ts`**  
Add a daily job (runs at 08:00) that:
1. Finds all tasks where `due_date < NOW()` AND `status = 'pending'`
2. Bulk updates their `status` to `'overdue'`
3. For each task, inserts a notification for `owner_id`:
   - `type: 'task_overdue'`
   - `message: 'Task overdue: <title> on <company_name>'`
   - Links to the lead via `lead_id`

**`backend/src/app.ts`** (or wherever routes are registered)  
Register the two new routers:
```typescript
app.use('/api/activities', activitiesRouter)
app.use('/api/tasks',      tasksRouter)
```

---

## Frontend

### New files

**`frontend/src/lib/api/activities.ts`**

```typescript
getActivities(leadId: string): Promise<Activity[]>
createActivity(leadId: string, data: { type: ActivityType; description: string }): Promise<Activity>
```

**`frontend/src/lib/api/tasks.ts`**

```typescript
getTasks(leadId: string): Promise<Task[]>
createTask(leadId: string, data: CreateTaskPayload): Promise<Task>
completeTask(taskId: string): Promise<Task>
deleteTask(taskId: string): Promise<void>
```

**`frontend/src/components/leads/ActivityTasksTab.tsx`**

Two sections rendered in one tab:

**Tasks section:**
- "+ Add Task" button toggles an inline form: title (required), type dropdown, due date (required), priority (optional, defaults medium)
- Task list sorted by due date ascending
- Each task card:
  - Checkbox → calls `completeTask`, strikes through title on success
  - Type icon + title + due date
  - Overdue tasks: red background, "Overdue" badge
  - Completed tasks: grey, struck through
  - Delete button (visible only if `task.owner_id === currentUser.id`)

**Activity Log section:**
- "+ Log Activity" button toggles an inline form: type dropdown (call/email/meeting/note), description textarea
- Timeline list sorted newest first
- Each entry:
  - Icon by type: 📞 call, ✉️ email, 🤝 meeting, 📝 note, 🔄 stage_change
  - Description text
  - Author name (or "Auto" for stage_change)
  - Relative time (e.g. "2h ago", "3 days ago")

### Modified files

**`frontend/src/components/kanban/DealModal.tsx`**
- Add a tab bar above the form content: `Details` | `Activity & Tasks`
- `Details` tab = existing form (no changes to form itself)
- `Activity & Tasks` tab = renders `<ActivityTasksTab leadId={lead.id} />`
- Active tab stored in local `useState`

---

## Notifications

The existing `notifications` table and `NotificationBell` component are already in place. The scheduler inserts rows using the same pattern as the trial expiry notifications. No changes to the notification UI needed — overdue task alerts appear in the bell feed automatically.

Notification types to add to the existing type check constraint:
- `task_overdue`

---

## Types (TypeScript)

```typescript
type ActivityType = 'note' | 'call' | 'email' | 'meeting' | 'stage_change'

interface Activity {
  id: string
  leadId: string
  type: ActivityType
  description: string
  ownerName: string   // joined from users.display_name
  createdAt: string
}

type TaskType = 'call' | 'email' | 'meeting' | 'follow-up' | 'other'
type TaskStatus = 'pending' | 'completed' | 'overdue'
type TaskPriority = 'low' | 'medium' | 'high'

interface Task {
  id: string
  leadId: string
  title: string
  description?: string
  type: TaskType
  dueDate: string
  status: TaskStatus
  priority: TaskPriority
  ownerId: string
  ownerName: string
  createdAt: string
  completedAt?: string
}

interface CreateTaskPayload {
  title: string
  type: TaskType
  dueDate: string
  description?: string
  priority?: TaskPriority
}
```

---

## Out of Scope

- Assigning tasks to other team members (self-only for now)
- Editing an activity after it is logged (immutable by design — matches existing DB comment)
- Editing a task after creation (delete and re-create)
- Real-time updates when another user logs an activity on the same lead
