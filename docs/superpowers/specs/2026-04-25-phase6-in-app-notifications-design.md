# Phase 6 — In-App Notifications: Design Spec

**Date:** 2026-04-25
**Project:** DOK CRM SaaS
**Phase:** 6 of 8
**Status:** Approved — ready for implementation

---

## 1. Overview

Add a real-time in-app notification system for all users. Notifications are generated server-side when key events occur (lead assigned, stage changed, task assigned, task due/overdue, team changes), delivered to the browser via 30-second polling, and displayed in a bell-icon feed in the app header. Users can dismiss individual notifications or mark all as read.

---

## 2. Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Delivery mechanism | 30-second polling | Zero infrastructure overhead; delay is imperceptible in a CRM context |
| Notification generation | `NotificationService` (service layer) | Centralises all routing, recipient resolution, and message formatting in one file |
| Dismissal | Individual × + "Mark all as read" | C — both options selected |
| Recipient scoping | Per event type | Lead/task events → recipient only; team events → all admins in tenant |
| Self-notification | Never | If actor === recipient, skip silently |
| Scheduled notifications | `node-cron` daily at 08:00 | Checks task due today and overdue tasks, fires notifications for their assignees |
| Retention | No auto-expiry | Dismissed notifications remain in DB (soft-removed via `dismissed_at`); visible feed shows only non-dismissed |

---

## 3. Database

### New migration: `backend/migrations/013_notifications.sql`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(64) NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT NOT NULL,
  link         VARCHAR(255),
  read_at      TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id  ON notifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at DESC);
```

### Notification types

| Type | Description |
|------|-------------|
| `lead_assigned` | A lead was assigned (or re-assigned) to the user |
| `lead_stage_changed` | A lead owned by the user moved to a new stage |
| `lead_deleted` | A lead owned by the user was soft-deleted |
| `lead_restored` | A deleted lead owned by the user was restored |
| `task_assigned` | A task was assigned (or re-assigned) to the user |
| `task_due_today` | A task assigned to the user is due today |
| `task_overdue` | A task assigned to the user is past its due date and incomplete |
| `team_member_added` | A new user was created in the tenant (admins only) |
| `user_deactivated` | A user in the tenant was deactivated (admins only) |

---

## 4. Backend

### 4.1 New files

| File | Purpose |
|------|---------|
| `backend/src/models/notificationModel.ts` | DB operations for `notifications` |
| `backend/src/services/notificationService.ts` | Named functions per event type |
| `backend/src/controllers/notificationController.ts` | HTTP handlers for notification endpoints |
| `backend/src/routes/notifications.ts` | Route wiring (all behind `requireAuth`) |
| `backend/src/scheduler.ts` | `node-cron` job for task due/overdue notifications |

### 4.2 Modified files

| File | Change |
|------|--------|
| `backend/src/controllers/leadController.ts` | Call NotificationService on assign, stage change, delete, restore |
| `backend/src/controllers/taskController.ts` | Call NotificationService on create/reassign |
| `backend/src/controllers/userController.ts` | Call NotificationService on create user, deactivate user |
| `backend/src/index.ts` | Mount `/api/notifications` router; start scheduler |

---

### 4.3 Model — `notificationModel.ts`

```typescript
createNotification(params: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}): Promise<void>

getNotifications(userId: string, tenantId: string, limit?: number): Promise<Notification[]>
// Returns non-dismissed notifications ordered by created_at DESC.
// Unread (read_at IS NULL) first, then read.

getUnreadCount(userId: string, tenantId: string): Promise<number>

markAllRead(userId: string, tenantId: string): Promise<void>
// Sets read_at = NOW() WHERE read_at IS NULL

dismissNotification(id: string, userId: string, tenantId: string): Promise<void>
// Sets dismissed_at = NOW() — scoped to userId+tenantId to prevent cross-user dismiss
```

### 4.4 Service — `notificationService.ts`

All functions are fire-and-forget (async, caller does not await — errors are caught and logged internally, never thrown to the caller).

```typescript
notifyLeadAssigned(params: {
  tenantId: string; assigneeId: string; actorId: string;
  leadId: string; companyName: string;
}): Promise<void>

notifyLeadStageChanged(params: {
  tenantId: string; assigneeId: string; actorId: string;
  leadId: string; companyName: string; oldStage: string; newStage: string;
}): Promise<void>

notifyLeadDeleted(params: {
  tenantId: string; assigneeId: string; actorId: string;
  leadId: string; companyName: string;
}): Promise<void>

notifyLeadRestored(params: {
  tenantId: string; assigneeId: string; actorId: string;
  leadId: string; companyName: string;
}): Promise<void>

notifyTaskAssigned(params: {
  tenantId: string; assigneeId: string; actorId: string;
  taskId: string; taskTitle: string;
}): Promise<void>

notifyTaskDueToday(params: {
  tenantId: string; assigneeId: string;
  taskId: string; taskTitle: string;
}): Promise<void>

notifyTaskOverdue(params: {
  tenantId: string; assigneeId: string;
  taskId: string; taskTitle: string; dueDate: string;
}): Promise<void>

notifyTeamMemberAdded(params: {
  tenantId: string; adminIds: string[];
  newUserName: string; newUserEmail: string;
}): Promise<void>

notifyUserDeactivated(params: {
  tenantId: string; adminIds: string[];
  userName: string;
}): Promise<void>
```

**Self-notification guard:** every function checks `if (assigneeId === actorId) return` before creating the notification.

For `notifyTeamMemberAdded` and `notifyUserDeactivated`, the service creates one notification per admin in `adminIds`.

### 4.5 Controller — `notificationController.ts`

All routes require `requireAuth` middleware. User identity comes from `req.user` (injected by auth middleware).

#### `GET /api/notifications`

Returns unread count and the 20 most recent non-dismissed notifications.

**Response:**
```json
{
  "unreadCount": 3,
  "notifications": [
    {
      "id": "uuid",
      "type": "lead_assigned",
      "title": "Lead assigned to you",
      "body": "Acme Corp was assigned to you by Jane.",
      "link": "/leads",
      "readAt": null,
      "createdAt": "2026-04-25T08:00:00Z"
    }
  ]
}
```

#### `POST /api/notifications/mark-all-read`

Sets `read_at = NOW()` for all unread notifications belonging to the authenticated user.

**Response:** `200 { message: 'All notifications marked as read' }`

#### `DELETE /api/notifications/:id`

Sets `dismissed_at = NOW()` for the specified notification. Scoped to the authenticated user's tenant — returns `404` if not found or not owned by the user.

**Response:** `200 { message: 'Notification dismissed' }`

### 4.6 Scheduler — `scheduler.ts`

Uses `node-cron` to run a job daily at 08:00 server time.

**Job logic:**
1. Query all active tasks where `due_date = TODAY` and `status != 'completed'` — fire `notifyTaskDueToday` for each assignee
2. Query all active tasks where `due_date < TODAY` and `status != 'completed'` — fire `notifyTaskOverdue` for each assignee
3. Errors are caught per-task and logged; one failure does not abort the rest

`startScheduler()` is exported and called once from `backend/src/index.ts` on server start.

### 4.7 Event triggers

| Controller | Trigger | Service call |
|---|---|---|
| `leadController.createLead` | lead has an owner | `notifyLeadAssigned` |
| `leadController.updateLead` | owner_id changed | `notifyLeadAssigned` (new assignee) |
| `leadController.updateLead` | sales_stage changed | `notifyLeadStageChanged` |
| `leadController.deleteLead` | soft-delete | `notifyLeadDeleted` |
| `leadController.restoreLead` | restore | `notifyLeadRestored` |
| `taskController.createTask` | task has an assignee | `notifyTaskAssigned` |
| `taskController.updateTask` | assignee changed | `notifyTaskAssigned` (new assignee) |
| `userController.createUserHandler` | user created | `notifyTeamMemberAdded` (all admins) — controller queries `SELECT id FROM users WHERE tenant_id=$1 AND role='admin' AND is_active=true` to build `adminIds` |
| `userController.updateUserHandler` | is_active changed to false | `notifyUserDeactivated` (all admins) — same admin query |

All notification calls are non-blocking: controllers call the service function without `await` and catch any thrown errors silently so notification failures never break the primary action.

---

## 5. Frontend

### 5.1 New files

| File | Purpose |
|------|---------|
| `frontend/src/store/notificationStore.ts` | Zustand store — state, polling, actions |
| `frontend/src/lib/api/notificationsApi.ts` | API functions for notifications |
| `frontend/src/components/notifications/NotificationBell.tsx` | Bell icon + unread badge |
| `frontend/src/components/notifications/NotificationFeed.tsx` | Popover feed content |

### 5.2 Modified files

| File | Change |
|------|--------|
| `frontend/src/components/layout/Header.tsx` | Add `<NotificationBell />` |
| `frontend/src/components/layout/AppLayout.tsx` | Call `startPolling()` on mount, `stopPolling()` on unmount |

### 5.3 API — `notificationsApi.ts`

```typescript
fetchNotifications(): Promise<{ unreadCount: number; notifications: Notification[] }>
markAllRead(): Promise<void>
dismissNotification(id: string): Promise<void>
```

### 5.4 Store — `notificationStore.ts`

```typescript
interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  fetchNotifications: () => Promise<void>
  markAllRead: () => Promise<void>
  dismiss: (id: string) => Promise<void>
  startPolling: () => void
  stopPolling: () => void
}
```

- `startPolling()` calls `fetchNotifications()` immediately, then sets a `setInterval` at 30 000 ms
- `stopPolling()` clears the interval
- `dismiss(id)` optimistically removes the notification from local state before the API call

### 5.5 Components

#### `NotificationBell.tsx`
- Renders a `Bell` icon (lucide-react) inside a `Button` variant="ghost"
- Shows a red circular badge with `unreadCount` when > 0; hidden when 0
- Clicking opens a `Popover` containing `<NotificationFeed />`

#### `NotificationFeed.tsx`
- Header row: "Notifications" title + "Mark all as read" button (hidden when `unreadCount === 0`)
- Scrollable list (max-height ~400px) of `NotificationItem` rows
- Each row:
  - Blue left border when unread (`read_at === null`)
  - `title` in bold, `body` in muted text, relative timestamp ("2 min ago")
  - **×** dismiss button on the right
  - Clicking the row navigates to `notification.link` (if set) via `useNavigate`
- Empty state: "No notifications" centered text
- Reads from `notificationStore`

### 5.6 Notification type definition

```typescript
interface Notification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  readAt: string | null
  createdAt: string
}
```

---

## 6. Navigation links per type

| Type | `link` value |
|------|-------------|
| `lead_assigned` | `/leads` |
| `lead_stage_changed` | `/leads` |
| `lead_deleted` | `/leads/deleted` |
| `lead_restored` | `/leads` |
| `task_assigned` | `/tasks` |
| `task_due_today` | `/tasks` |
| `task_overdue` | `/tasks` |
| `team_member_added` | `/admin/team` |
| `user_deactivated` | `/admin/team` |

---

## 7. Security Rules

| Rule | Detail |
|------|--------|
| Tenant scoping | All queries filter by both `user_id` AND `tenant_id` |
| Dismiss ownership | `DELETE /notifications/:id` verifies `user_id = req.user.userId` before updating |
| No cross-tenant reads | `GET /notifications` filters by `req.user.userId` + `req.user.tenantId` |
| Notification failures are silent | Service errors are caught and logged; primary actions never fail due to notification errors |

---

## 8. What is NOT in Phase 6

- Email notifications (Phase 7+)
- Push notifications (browser/mobile)
- Per-type notification preferences (opt-in/out per event type)
- Real-time delivery (WebSockets or SSE)
- Notification expiry / automatic cleanup
- Paginated notification history beyond 20 items
