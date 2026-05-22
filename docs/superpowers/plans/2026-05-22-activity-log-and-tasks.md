# Activity Log & Follow-up Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Activity & Tasks" tab to the lead DealModal so reps can log calls/notes and create follow-up tasks per lead.

**Architecture:** The backend controllers, routes, models, and scheduler for both activities and tasks already exist and are registered. The work is (1) three small backend fixes — join `ownerName`, block manual `stage_change`, auto-log stage transitions — (2) one new `findTasksByLead` query + route, and (3) one new `ActivityTasksTab.tsx` component wired into `DealModal` via a tab bar.

**Tech Stack:** Node/Express/PostgreSQL backend (TypeScript), React + Vite frontend (TypeScript), Tailwind CSS, shadcn/ui, Zustand, react-hook-form, zod, sonner (toasts).

---

## File Map

| File | Action | What changes |
|---|---|---|
| `backend/src/models/activityModel.ts` | Modify | `findActivitiesByLead` joins `display_name` as `owner_name` |
| `backend/src/controllers/activityController.ts` | Modify | Block `stage_change` type in `createActivityHandler` |
| `backend/src/controllers/leadController.ts` | Modify | Auto-log stage change to activities in `updateLeadHandler` |
| `backend/src/models/taskModel.ts` | Modify | Add `findTasksByLead` query |
| `backend/src/controllers/taskController.ts` | Modify | Add `listTasksByLead` handler |
| `backend/src/routes/tasks.ts` | Modify | Add `GET /lead/:leadId` route |
| `frontend/src/models/index.ts` | Modify | Add `ownerName` to `Activity` interface |
| `frontend/src/services/activityService.ts` | Modify | `getActivitiesByLead` already exists — verify URL matches backend |
| `frontend/src/services/taskService.ts` | Modify | Add `getTasksByLead(leadId)` function |
| `frontend/src/components/leads/ActivityTasksTab.tsx` | **Create** | Combined tasks + activity log tab |
| `frontend/src/components/kanban/DealModal.tsx` | Modify | Add Details / Activity & Tasks tab bar |

---

## Task 1: Join `ownerName` in activity queries + block `stage_change` in manual creation

**Files:**
- Modify: `backend/src/models/activityModel.ts`
- Modify: `backend/src/controllers/activityController.ts`

- [ ] **Step 1: Update `findActivitiesByLead` to join `display_name`**

Open `backend/src/models/activityModel.ts`. Replace the mapper and `findActivitiesByLead` function:

```typescript
export const mapActivity = (row: Record<string, unknown>) => ({
  id:          row.id,
  leadId:      row.lead_id,
  type:        row.type,
  description: row.description,
  metadata:    row.metadata,
  ownerId:     row.owner_id,
  ownerName:   row.owner_name as string | null,
  tenantId:    row.tenant_id,
  createdAt:   row.created_at,
});

export async function findActivitiesByLead(leadId: string, tenantId: string) {
  const result = await query(
    `SELECT a.*, u.display_name AS owner_name
       FROM activities a
       LEFT JOIN users u ON u.id = a.owner_id
      WHERE a.lead_id = $1 AND a.tenant_id = $2
      ORDER BY a.created_at DESC`,
    [leadId, tenantId]
  );
  return result.rows.map(mapActivity);
}
```

- [ ] **Step 2: Block `stage_change` in `createActivityHandler`**

Open `backend/src/controllers/activityController.ts`. In `createActivityHandler`, after the `!type || !description` check, add:

```typescript
const MANUAL_TYPES = ['note', 'call', 'email', 'meeting'] as const;
if (!MANUAL_TYPES.includes(type)) {
  res.status(400).json({ error: 'Invalid activity type' });
  return;
}
```

Full updated function:

```typescript
export async function createActivityHandler(req: Request, res: Response) {
  const { leadId, type, description, metadata } = req.body;
  if (!type || !description) {
    res.status(400).json({ error: 'type and description required' });
    return;
  }
  const MANUAL_TYPES = ['note', 'call', 'email', 'meeting'] as const;
  if (!MANUAL_TYPES.includes(type)) {
    res.status(400).json({ error: 'Invalid activity type' });
    return;
  }
  try {
    const activity = await createActivity({
      leadId:   leadId || null,
      type,
      description,
      metadata: metadata ?? null,
      ownerId:  req.user!.userId,
      tenantId: req.user!.tenantId,
    });
    res.status(201).json(activity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 3: Test manually**

Start the backend: `cd backend && npm run dev`

POST to `/api/activities` with `{ "leadId": "<any-valid-lead-uuid>", "type": "stage_change", "description": "test" }` — expect `400 Invalid activity type`.

POST with `{ "leadId": "<uuid>", "type": "call", "description": "Called John" }` — expect `201` with activity object containing `ownerName`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/models/activityModel.ts backend/src/controllers/activityController.ts
git commit -m "feat(activities): join ownerName and block manual stage_change type"
```

---

## Task 2: Auto-log stage changes in `updateLeadHandler`

**Files:**
- Modify: `backend/src/controllers/leadController.ts`

- [ ] **Step 1: Import `createActivity` at the top of `leadController.ts`**

Add to the existing imports at the top of `backend/src/controllers/leadController.ts`:

```typescript
import { createActivity } from '../models/activityModel';
```

- [ ] **Step 2: Add the auto-log after the stage-change notification**

In `updateLeadHandler`, find this existing block (around line 187):

```typescript
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
```

Replace it with:

```typescript
if (newStage && newStage !== oldStage) {
  void notifyLeadStageChanged({
    tenantId:    req.user!.tenantId,
    assigneeId:  newOwnerId,
    actorId:     req.user!.userId,
    companyName: lead.companyName as string,
    oldStage,
    newStage,
  });
  void createActivity({
    leadId:      lead.id as string,
    type:        'stage_change',
    description: `Stage changed: ${oldStage} → ${newStage}`,
    metadata:    null,
    ownerId:     req.user!.userId,
    tenantId:    req.user!.tenantId,
  });
}
```

- [ ] **Step 3: Test manually**

Update a lead's stage via the API or UI. Then call `GET /api/activities/lead/<leadId>` — expect a `stage_change` activity row in the response with the correct description.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/leadController.ts
git commit -m "feat(leads): auto-log stage changes to activity log"
```

---

## Task 3: Add `findTasksByLead` + route

**Files:**
- Modify: `backend/src/models/taskModel.ts`
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/routes/tasks.ts`

- [ ] **Step 1: Add `findTasksByLead` to `taskModel.ts`**

Add this function at the end of `backend/src/models/taskModel.ts`:

```typescript
export async function findTasksByLead(leadId: string, tenantId: string) {
  const result = await query(
    `SELECT t.*, u.display_name AS owner_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.owner_id
      WHERE t.lead_id = $1 AND t.tenant_id = $2
      ORDER BY t.due_date ASC`,
    [leadId, tenantId]
  );
  return result.rows.map((row) => ({
    ...mapTask(row),
    ownerName: row.display_name as string | null,
  }));
}
```

- [ ] **Step 2: Add `listTasksByLead` handler to `taskController.ts`**

Add the import at the top of `backend/src/controllers/taskController.ts`:

```typescript
import { findAllTasks, findTasksByLead, createTask, updateTask, removeTask } from '../models/taskModel';
```

Add the handler function after `listTasks`:

```typescript
export async function listTasksByLead(req: Request, res: Response) {
  try {
    const tasks = await findTasksByLead(req.params.leadId, req.user!.tenantId);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 3: Register the new route in `tasks.ts`**

Open `backend/src/routes/tasks.ts`. Add the import and route:

```typescript
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  listTasks,
  listTasksByLead,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
} from '../controllers/taskController';

const router = Router();

router.get('/',               requireAuth, listTasks);
router.get('/lead/:leadId',   requireAuth, listTasksByLead);
router.post('/',              requireAuth, createTaskHandler);
router.put('/:id',            requireAuth, updateTaskHandler);
router.delete('/:id',         requireAuth, deleteTaskHandler);

export default router;
```

- [ ] **Step 4: Test manually**

`GET /api/tasks/lead/<valid-lead-uuid>` — expect `[]` (no tasks yet, no error).

Create a task via `POST /api/tasks` with `{ "leadId": "<uuid>", "title": "Test task", "type": "call", "dueDate": "2026-06-01" }`.

`GET /api/tasks/lead/<uuid>` again — expect the task in the response with `ownerName` field.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/taskModel.ts backend/src/controllers/taskController.ts backend/src/routes/tasks.ts
git commit -m "feat(tasks): add findTasksByLead query and GET /api/tasks/lead/:leadId route"
```

---

## Task 4: Update frontend types and services

**Files:**
- Modify: `frontend/src/models/index.ts`
- Modify: `frontend/src/services/activityService.ts`
- Modify: `frontend/src/services/taskService.ts`

- [ ] **Step 1: Add `ownerName` to `Activity` interface in `frontend/src/models/index.ts`**

Find the `Activity` interface (around line 83) and add `ownerName`:

```typescript
export interface Activity {
  id: string
  leadId: string
  type: ActivityType
  description: string
  metadata?: Record<string, unknown>
  ownerId: string
  ownerName?: string | null
  createdAt?: ISODateString
}
```

- [ ] **Step 2: Verify `activityService.ts` URL matches backend**

Open `frontend/src/services/activityService.ts`. The existing `getActivitiesByLead` calls `/api/activities/lead/${leadId}` — this matches the backend route `GET /api/activities/lead/:leadId`. No change needed.

- [ ] **Step 3: Add `getTasksByLead` to `taskService.ts`**

Open `frontend/src/services/taskService.ts`. Add after the existing `getTasks` function:

```typescript
export const getTasksByLead = (leadId: string) =>
  apiFetch<Task[]>(`/api/tasks/lead/${leadId}`);
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/models/index.ts frontend/src/services/taskService.ts
git commit -m "feat(frontend): add ownerName to Activity type and getTasksByLead service"
```

---

## Task 5: Create `ActivityTasksTab.tsx`

**Files:**
- Create: `frontend/src/components/leads/ActivityTasksTab.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/leads/ActivityTasksTab.tsx` with the full implementation:

```tsx
import { useState, useEffect } from 'react'
import { Plus, Phone, Mail, Users, FileText, RefreshCw, Loader2, Trash2, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getActivitiesByLead, createActivity } from '@/services/activityService'
import { getTasksByLead, createTask, completeTask, deleteTask } from '@/services/taskService'
import { useAuthUser } from '@/store/authStore'
import type { Activity, Task, ActivityType, TaskType } from '@/models'

const ACTIVITY_ICONS: Record<ActivityType, JSX.Element> = {
  call:         <Phone     className="h-4 w-4" />,
  email:        <Mail      className="h-4 w-4" />,
  meeting:      <Users     className="h-4 w-4" />,
  note:         <FileText  className="h-4 w-4" />,
  stage_change: <RefreshCw className="h-4 w-4" />,
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  call:         'bg-blue-100 text-blue-700',
  email:        'bg-purple-100 text-purple-700',
  meeting:      'bg-green-100 text-green-700',
  note:         'bg-yellow-100 text-yellow-700',
  stage_change: 'bg-gray-100 text-gray-600',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface Props {
  leadId: string
}

export function ActivityTasksTab({ leadId }: Props) {
  const user = useAuthUser()

  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [loading,    setLoading]    = useState(true)

  // Task form state
  const [showTaskForm,  setShowTaskForm]  = useState(false)
  const [taskTitle,     setTaskTitle]     = useState('')
  const [taskType,      setTaskType]      = useState<TaskType>('follow-up')
  const [taskDueDate,   setTaskDueDate]   = useState('')
  const [savingTask,    setSavingTask]    = useState(false)

  // Activity form state
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [actType,          setActType]          = useState<ActivityType>('call')
  const [actDescription,   setActDescription]   = useState('')
  const [savingActivity,   setSavingActivity]   = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      getActivitiesByLead(leadId),
      getTasksByLead(leadId),
    ]).then(([acts, tsks]) => {
      if (cancelled) return
      setActivities(acts)
      setTasks(tsks)
    }).catch(() => {
      if (!cancelled) toast.error('Failed to load activity data')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [leadId])

  async function handleCreateTask() {
    if (!taskTitle.trim() || !taskDueDate) return
    setSavingTask(true)
    try {
      const task = await createTask({ leadId, title: taskTitle.trim(), type: taskType, dueDate: taskDueDate })
      setTasks(prev => [...prev, task].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()))
      setTaskTitle('')
      setTaskDueDate('')
      setTaskType('follow-up')
      setShowTaskForm(false)
      toast.success('Task created')
    } catch {
      toast.error('Failed to create task')
    } finally {
      setSavingTask(false)
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      const updated = await completeTask(taskId)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
    } catch {
      toast.error('Failed to complete task')
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {
      toast.error('Failed to delete task')
    }
  }

  async function handleLogActivity() {
    if (!actDescription.trim()) return
    setSavingActivity(true)
    try {
      const act = await createActivity({ leadId, type: actType, description: actDescription.trim() })
      setActivities(prev => [act, ...prev])
      setActDescription('')
      setActType('call')
      setShowActivityForm(false)
      toast.success('Activity logged')
    } catch {
      toast.error('Failed to log activity')
    } finally {
      setSavingActivity(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const pendingTasks = tasks.filter(t => t.status !== 'completed')
  const doneTasks    = tasks.filter(t => t.status === 'completed')

  return (
    <div className="space-y-6 py-2">

      {/* ── Tasks section ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Tasks
            {pendingTasks.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingTasks.length}</Badge>
            )}
          </h3>
          {!showTaskForm && (
            <Button size="sm" variant="outline" onClick={() => setShowTaskForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Task
            </Button>
          )}
        </div>

        {showTaskForm && (
          <div className="border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
            <Input
              placeholder="Task title"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
            />
            <div className="flex gap-2">
              <Select value={taskType} onValueChange={v => setTaskType(v as TaskType)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                className="flex-1"
                value={taskDueDate}
                onChange={e => setTaskDueDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowTaskForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateTask} disabled={savingTask || !taskTitle.trim() || !taskDueDate}>
                {savingTask ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {pendingTasks.length === 0 && !showTaskForm && (
            <p className="text-xs text-muted-foreground py-2">No pending tasks.</p>
          )}
          {pendingTasks.map(task => (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                task.status === 'overdue' ? 'bg-red-50 border-red-200' : 'bg-background'
              }`}
            >
              <button
                onClick={() => handleCompleteTask(task.id)}
                className="mt-0.5 text-muted-foreground hover:text-primary flex-shrink-0"
                title="Mark complete"
              >
                <CheckSquare className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className={`text-xs mt-0.5 ${task.status === 'overdue' ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {task.status === 'overdue' ? '⚠ Overdue · ' : ''}
                  {task.type} · Due {new Date(task.dueDate).toLocaleDateString()}
                </p>
              </div>
              {task.ownerId === user?.id && (
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  title="Delete task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {doneTasks.length > 0 && (
            <details className="text-xs text-muted-foreground cursor-pointer">
              <summary className="py-1 select-none">{doneTasks.length} completed</summary>
              <div className="space-y-1 mt-1">
                {doneTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30 opacity-60">
                    <CheckSquare className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    <span className="line-through text-xs">{task.title}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* ── Activity Log section ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Activity Log</h3>
          {!showActivityForm && (
            <Button size="sm" variant="outline" onClick={() => setShowActivityForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Log Activity
            </Button>
          )}
        </div>

        {showActivityForm && (
          <div className="border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
            <Select value={actType} onValueChange={v => setActType(v as ActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="What happened?"
              value={actDescription}
              onChange={e => setActDescription(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowActivityForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleLogActivity} disabled={savingActivity || !actDescription.trim()}>
                {savingActivity ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Log'}
              </Button>
            </div>
          </div>
        )}

        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map(act => (
              <div key={act.id} className="flex gap-3">
                <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${ACTIVITY_COLORS[act.type as ActivityType]}`}>
                  {ACTIVITY_ICONS[act.type as ActivityType]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{act.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {act.type === 'stage_change' ? 'Auto' : (act.ownerName ?? 'Unknown')}
                    {' · '}
                    {act.createdAt ? timeAgo(act.createdAt) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify imports compile**

Run `cd frontend && npm run build 2>&1 | head -40` — fix any TypeScript errors before continuing. Common fixes:
- If `useAuthUser` doesn't exist, check `frontend/src/store/authStore.ts` for the correct hook name that returns the current user object with an `id` field
- If `JSX.Element` is not found, add `import type { JSX } from 'react'` at the top

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/leads/ActivityTasksTab.tsx
git commit -m "feat(frontend): add ActivityTasksTab component"
```

---

## Task 6: Add tab bar to `DealModal.tsx`

**Files:**
- Modify: `frontend/src/components/kanban/DealModal.tsx`

- [ ] **Step 1: Add tab state and import**

Open `frontend/src/components/kanban/DealModal.tsx`.

Add the import at the top (with existing imports):

```typescript
import { ActivityTasksTab } from '@/components/leads/ActivityTasksTab'
```

Inside the `DealModal` component function, add a new state variable alongside the existing state variables (e.g. next to `const [isLoading, setIsLoading] = useState(false)`):

```typescript
const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')
```

Also add a `useEffect` to reset the tab when the modal opens a different lead:

```typescript
useEffect(() => {
  setActiveTab('details')
}, [lead?.id])
```

- [ ] **Step 2: Add the tab bar to the modal JSX**

In the `DealModal` component's JSX, find the `<DialogContent>` element. After the `<DialogHeader>` block and before the form/scrollable area, insert the tab bar:

```tsx
{/* Tab bar — only show when editing an existing lead */}
{lead && (
  <div className="flex border-b mb-4 -mt-2">
    <button
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === 'details'
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
      onClick={() => setActiveTab('details')}
    >
      Details
    </button>
    <button
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        activeTab === 'activity'
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
      onClick={() => setActiveTab('activity')}
    >
      Activity & Tasks
    </button>
  </div>
)}
```

- [ ] **Step 3: Wrap the existing form content and add the activity tab**

Find the scrollable form area in `DealModal`. It likely starts with a `<div className="... overflow-y-auto ...">` or similar. Wrap its contents so only the active tab is shown:

```tsx
{/* Details tab */}
{activeTab === 'details' && (
  <div>
    {/* existing form content stays here, unchanged */}
  </div>
)}

{/* Activity & Tasks tab */}
{activeTab === 'activity' && lead && (
  <div className="overflow-y-auto max-h-[60vh] px-1">
    <ActivityTasksTab leadId={lead.id} />
  </div>
)}
```

The `<DialogFooter>` with Save/Delete buttons should remain outside this conditional so they're always visible — but hide the footer when on the activity tab since there's nothing to save there:

```tsx
{activeTab === 'details' && (
  <DialogFooter>
    {/* existing footer buttons */}
  </DialogFooter>
)}
```

- [ ] **Step 4: Build and smoke-test**

```bash
cd frontend && npm run build
```

Fix any TypeScript errors. Then start the dev server:

```bash
npm run dev
```

Open a lead in the Pipeline or Leads page. Verify:
1. "Details" and "Activity & Tasks" tabs appear when editing an existing lead
2. The "Details" tab shows the existing form — unchanged
3. Clicking "Activity & Tasks" shows the new tab with "Tasks" and "Activity Log" sections
4. The tab bar does NOT appear when creating a new lead (only `lead` prop present triggers it)

- [ ] **Step 5: Test the full flow**

1. Open a lead → click "Activity & Tasks"
2. Click "+ Add Task" → fill title + due date → Save → task appears in the list
3. Click the checkbox on the task → it moves to the "completed" section
4. Click the delete button on a task → it disappears
5. Click "+ Log Activity" → select "Call" → type description → Log → entry appears in the timeline
6. In another tab, update the lead's stage → come back and open "Activity & Tasks" → a `stage_change` auto-entry should appear in the Activity Log

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/kanban/DealModal.tsx
git commit -m "feat(frontend): add Details / Activity & Tasks tab bar to DealModal"
```

---

## Task 7: Push to main and deploy

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Deploy on server**

```bash
git pull
docker compose build backend frontend
docker compose up -d backend frontend nginx
```

No migration needed — `tenant_id` was already added to both `activities` and `tasks` tables in migration `009`.

- [ ] **Step 3: Smoke-test on production**

Open a real lead on the live site, click "Activity & Tasks", log a call, create a task — confirm everything works end-to-end.
