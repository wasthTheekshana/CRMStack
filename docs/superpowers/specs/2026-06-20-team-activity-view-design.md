# Team Activity View — Design

**Date:** 2026-06-20
**Status:** Approved (design)

## Problem

Managers/admins need an easy way to see what each team member has logged —
calls, meetings, notes, and stage changes — so they can keep track of who is
doing what. Today this only surfaces in a small "Recent Activities" dashboard
card (top 5, no owner name, no filtering) and a per-lead tab. There is no
per-person, filterable view of team activity.

## Goals

- Admins can view all team members' activities in one place.
- Admins can narrow the view by **member**, **activity type**, **date range**,
  and **lead/company**.
- Each entry clearly shows **who** logged it, **what**, the related lead, and
  **when**.

## Non-Goals (deferred)

- No notifications when a member logs an activity (the page is pull-based).
- No change to what sales reps can see — they continue to see only their own
  activities.
- No CSV export of this view (can be added later if needed).

## Permission Model

- **Admin:** may see every member's activities in the tenant and use all
  filters. Omitting the member filter returns all members.
- **Sales:** unchanged. They only ever receive their own activities. Any
  cross-member filter is ignored / forced back to their own user id. This
  preserves the existing tenant + owner scoping (the IDOR fix on
  `listActivitiesByLead`).

## Backend

Extend the existing endpoint rather than adding a new one.

### `GET /api/activities` — new optional query params

| Param       | Type   | Applies to | Meaning                                                  |
|-------------|--------|------------|----------------------------------------------------------|
| `ownerId`   | uuid   | admin only | Specific member. Omitted = all members.                  |
| `type`      | string | both       | One of `call` `email` `meeting` `note` `stage_change`.   |
| `leadId`    | uuid   | both       | Activities for a single lead.                            |
| `startDate` | ISO    | both       | Inclusive lower bound on `created_at`.                   |
| `endDate`   | ISO    | both       | Inclusive upper bound on `created_at`.                   |
| `limit`     | int    | both       | Default 200, max 500. Replaces the hard-coded 100 cap.   |

Validation:
- `type` must be in the allowed set, else 400.
- `ownerId` / `leadId` must be valid UUIDs (reuse the UUID regex pattern), else 400.
- `startDate` / `endDate` must parse as dates, else 400.
- For a **sales** caller, `ownerId` is forced to the caller's own id regardless
  of what is passed; admins may pass any `ownerId` belonging to the tenant.

### Model change — `findAllActivities`

`findAllActivities(userId, tenantId, isAdmin, filters?)` builds a parameterized
`WHERE` clause:

- Always: `a.tenant_id = $tenant`.
- Non-admin: always `AND a.owner_id = $caller`.
- Admin + `ownerId`: `AND a.owner_id = $ownerId`.
- `type`: `AND a.type = $type`.
- `leadId`: `AND a.lead_id = $leadId`.
- `startDate`: `AND a.created_at >= $startDate`.
- `endDate`: `AND a.created_at <= $endDate`.
- `ORDER BY a.created_at DESC LIMIT $limit`.

Still joins `users` for `owner_name` (already present). No schema changes.

## Frontend

### Route & navigation

- New page `frontend/src/pages/admin/TeamActivity.tsx`.
- Route `team-activity` inside the protected layout, wrapped in
  `<RoleGuard allowedRoles={['admin']}>` (matches `RepComparison`,
  `TeamManagement`, etc.).
- Sidebar link in the admin section pointing to `/team-activity`.

### Layout

- **Filter bar** (top):
  - **Member** dropdown: "All members" + each sales user
    (from `GET /api/users/sales`). Primary selector.
  - **Type** dropdown: All / Call / Meeting / Email / Note / Stage change.
  - **Date range**: Today / This week / This month / Custom (custom = two date
    inputs).
  - **Lead/Company** picker: searchable, optional. Labelled by company name;
    filters by the selected lead's id.
- **Results**: chronological list grouped by day. Each row shows the type icon
  + color (reuse the maps in `RecentActivities`), the **member name**, the
  description, the linked lead/company, and relative time.
- **Empty state** when nothing matches the filters.

### Data flow

1. On mount: fetch sales users (member dropdown) and activities with default
   filters (all members, all types, this month).
2. On any filter change: re-fetch `GET /api/activities` with the current query
   params; re-render the grouped list.
3. All filtering is server-side; the client only groups by day for display.

### Service layer

Extend `getActivities` in `frontend/src/services/activityService.ts` (and/or
`lib/api/collections`) to accept an optional filters object and serialize it to
query params.

## Testing

- **Backend:** `findAllActivities` returns correctly filtered rows for each
  filter combination; a sales caller cannot retrieve another member's
  activities even when passing `ownerId`; invalid `type`/uuid/date returns 400;
  `limit` is clamped to 500.
- **Frontend:** the page renders for admins only (RoleGuard); changing each
  filter triggers a refetch with the right params; empty state shows when no
  results.

## Affected Files

- `backend/src/controllers/activityController.ts` — parse/validate query params,
  enforce sales scoping, pass filters to the model.
- `backend/src/models/activityModel.ts` — extend `findAllActivities` with the
  optional parameterized filters and configurable limit.
- `frontend/src/pages/admin/TeamActivity.tsx` — new page.
- `frontend/src/App.tsx` — new guarded route.
- `frontend/src/components/layout/Sidebar.tsx` — new admin nav link.
- `frontend/src/services/activityService.ts` (and `lib/api/collections`) —
  filter-aware `getActivities`.
