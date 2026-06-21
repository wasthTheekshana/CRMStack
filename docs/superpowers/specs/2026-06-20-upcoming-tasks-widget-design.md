# Upcoming Tasks Dashboard Widget — Design

**Date:** 2026-06-20
**Status:** Approved (design)

## Problem

A sales rep has no quick, at-a-glance view of what they need to do. The dashboard
shows recent *logged activities* (history) but not their *upcoming/pending tasks*
(calls to make, meetings to attend, follow-ups). The rep wants to see, on the
dashboard, "what calls I want to take" and "what meetings are pending / to follow up".

## Goal

Add an "Upcoming Tasks" card to the sales dashboard showing the rep's own pending
tasks, filterable by type, with overdue/today highlighting.

## Non-Goals

- No backend or DB changes (the existing `GET /api/tasks` already returns the
  rep's own tasks, sorted by due date).
- No task create/edit/complete from the widget (the Tasks page already does that).
  The card title links to the Tasks page for actions.
- Admin dashboard is unchanged (this is the sales dashboard).

## Approach

Frontend-only widget reading the existing endpoint; filter client-side (a rep's
task list is small).

## Component

`frontend/src/components/dashboard/UpcomingTasks.tsx`, exported as
`export function UpcomingTasks()`.

- Data: `getTasks()` from `@/services/taskService` (already scoped to the caller's
  own tasks for a sales user). On mount, fetch once.
- Filtering/sorting (client-side):
  - Drop tasks with `status === 'completed'`.
  - Sort by `dueDate` ascending (earliest first; overdue surfaces at top).
- Type filter (chips/buttons): `All | call | meeting | follow-up | email`. Selecting
  a type narrows the list; default `All`. (Type `other` is included only under `All`.)
- Row rendering (reuse the icon/colour style from `RecentActivities`):
  - Icon per type: call→Phone, meeting→Calendar, email→Mail, follow-up→ArrowRight,
    other→FileText.
  - Title, optional description line.
  - Due-date badge derived from `dueDate` vs now:
    - past (and not completed) → red "Overdue"
    - same calendar day → amber "Today"
    - otherwise → formatted date (e.g. relative or short date).
- States: loading skeleton; empty state per filter (e.g. "No calls coming up").
- Header: "Upcoming Tasks" with a link/affordance to the full Tasks page (`/tasks`).

## Placement

In `frontend/src/pages/sales/SalesDashboard.tsx`, add the widget directly under the
KPI-card grid (top of the dashboard) for quick access. Existing charts/activities
rows are unchanged.

## Testing

- Frontend typecheck (`tsc --noEmit`) clean.
- Manual/e2e: a sales rep with seeded tasks sees pending tasks; completed tasks are
  excluded; type filter narrows correctly; an overdue task shows the red badge.
  (A Playwright check can mint a sales JWT, create tasks via `POST /api/tasks`,
  load the dashboard, and assert the widget shows them — optional, harness permitting.)

## Affected Files

- Create: `frontend/src/components/dashboard/UpcomingTasks.tsx`
- Modify: `frontend/src/pages/sales/SalesDashboard.tsx` (render the widget)
