# Editable Tasks/Activities + Type-Grouped Dashboard — Design

**Date:** 2026-06-20
**Status:** Approved (design)

## Problem

1. Members can create tasks and activities and can complete/delete tasks, but
   **cannot edit** them after creation — and activities have no edit path at all
   (the backend has no activity update endpoint).
2. The dashboard shows tasks and the activity log as flat lists. Members want them
   organized **by type** (Calls, Meetings, Follow-ups, Emails, Notes) for an
   at-a-glance "what calls / what meetings" view.

## Goals

- A member can edit their own tasks and activities from the lead's
  **Activity & Tasks** tab; admins can edit any in their tenant.
- The dashboard's Upcoming Tasks and Recent Activities cards group items by type.

## Non-Goals

- No activity delete (edit only; tasks already support delete). Can be added later.
- Auto `stage_change` activities remain non-editable (system-generated).
- No change to who can see what (existing tenant + owner scoping is preserved).

## Part A — Backend: activity update

### Model — `backend/src/models/activityModel.ts`
Add:
```ts
export async function updateActivity(
  id: string,
  tenantId: string,
  data: { type?: string; description?: string },
  ownerId?: string
)
```
- Parameterized `UPDATE activities SET type = COALESCE(...), description = COALESCE(...)
  WHERE id = $ AND tenant_id = $ [AND owner_id = $]` returning the row via `mapActivity`.
- `ownerId` provided (non-admins) restricts to their own activity; `undefined` (admins)
  allows any in the tenant. Returns `null` if no row matched.

### Controller — `backend/src/controllers/activityController.ts`
Add `updateActivityHandler`:
- Validate `type` (if present) is in `MANUAL_TYPES` (note/call/email/meeting); reject
  `stage_change` and unknown types with 400.
- Require at least one of `type`/`description`.
- `ownerScope = role === 'admin' ? undefined : userId`.
- Call `updateActivity`; 404 if null.

### Route — `backend/src/routes/activities.ts`
`router.put('/:id', requireAuth, validateUUIDParam('id'), updateActivityHandler)`
(reuse the existing `validateUUIDParam` middleware as the leads routes do).

## Part B — Frontend: edit on the lead's Activity & Tasks tab

File: `frontend/src/components/leads/ActivityTasksTab.tsx`

- **Service:** add `updateActivity(id, data)` to
  `frontend/src/services/activityService.ts` → `PUT /api/activities/:id`.
- **Tasks:** add an Edit (pencil) button per pending task (visible to the owner / admin)
  that opens an inline form pre-filled with title, type, due date; Save calls the
  existing `updateTask(id, data)` and updates local state; Cancel closes.
- **Activities:** add an Edit button per activity **except** `stage_change`, opening an
  inline form pre-filled with type + description; Save calls `updateActivity` and
  updates local state.
- Reuse the existing inline-form styling already used by the create forms.

## Part C — Dashboard grouped by type

- **Upcoming Tasks** (`frontend/src/components/dashboard/UpcomingTasks.tsx`):
  replace the type filter chips with **type-grouped sections** in a fixed order:
  Calls, Meetings, Follow-ups, Emails, Other. Each section shows a header with a
  count and its pending items (soonest first), keeping the Overdue/Today badges.
  Sections with no items are hidden. Empty overall → existing empty state.
- **Recent Activities** (`frontend/src/components/dashboard/RecentActivities.tsx`):
  group the shown activities under type headers (Calls, Meetings, Emails, Notes;
  plus Stage changes if present). Keep the existing per-role fetch and the
  refresh-on-focus behavior.

## Testing

- **Backend (Playwright API):** a member can `PUT` their own activity (200) and
  cannot edit another member's (404/owner-scoped); invalid/`stage_change` type → 400;
  admin can edit any activity in the tenant.
- **Frontend typecheck** clean; manual/e2e: edit a task and an activity on the lead
  tab and see the change persist; dashboard shows items grouped by type.

## Affected Files

- `backend/src/models/activityModel.ts` — `updateActivity`
- `backend/src/controllers/activityController.ts` — `updateActivityHandler`
- `backend/src/routes/activities.ts` — `PUT /:id`
- `frontend/src/services/activityService.ts` — `updateActivity`
- `frontend/src/components/leads/ActivityTasksTab.tsx` — task + activity edit UI
- `frontend/src/components/dashboard/UpcomingTasks.tsx` — group by type
- `frontend/src/components/dashboard/RecentActivities.tsx` — group by type
