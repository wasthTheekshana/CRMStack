# Team Activity View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a filterable page to see every team member's logged activities (calls, meetings, emails, notes, stage changes), filterable by member, type, date range, and lead.

**Architecture:** Extend the existing `GET /api/activities` endpoint with optional, parameterized query filters (admins only for cross-member filtering; sales remain scoped to their own activities). Add one admin-only React page that drives those filters and renders the results grouped by day.

**Tech Stack:** Express + PostgreSQL (`pg`) backend, React + Vite + TypeScript frontend, Playwright e2e tests (the project's only test framework — no unit-test runner).

## Global Constraints

- Backend queries are always parameterized (`$1`, `$2`, …) — never string-interpolate user input into SQL.
- All activity reads stay tenant-scoped (`a.tenant_id = $tenant`).
- Sales users may only ever see their own activities; this preserves the existing IDOR fix. Admins may see all members in their tenant.
- Activity types are exactly: `note`, `stage_change`, `call`, `email`, `meeting`.
- Admin-only frontend routes use `<RoleGuard allowedRoles={['admin']}>` (matches `RepComparison`, `TeamManagement`).
- e2e tests require the Docker stack running (`docker compose up -d`) and seeded data (the Playwright global-setup seeds `dok-test` / `atl-test`). Tests authenticate by minting a JWT with `mintTestJwt` and injecting the `auth_token` cookie — never via the login form (rate limiter).
- Commit messages end with the project's `Co-Authored-By` trailer.

---

### Task 1: Backend — filterable activities endpoint

**Files:**
- Modify: `backend/src/models/activityModel.ts` (extend `findAllActivities`)
- Modify: `backend/src/controllers/activityController.ts` (`listActivities` — parse/validate query, enforce sales scoping)
- Test: `e2e/tests/team-activity-api.spec.ts` (create)

**Interfaces:**
- Consumes: `query` from `../config/db`; `mapActivity` (existing in `activityModel.ts`); `mintTestJwt`, `apiFetch` from `e2e/helpers/api`; `loadSeedData` from `e2e/fixtures`.
- Produces:
  - `interface ActivityFilters { ownerId?: string; type?: string; leadId?: string; startDate?: string; endDate?: string; limit?: number }`
  - `findAllActivities(userId: string, tenantId: string, isAdmin: boolean, filters?: ActivityFilters): Promise<Activity[]>` — extended signature, backward compatible (filters optional).
  - `GET /api/activities` now accepts optional query params `ownerId`, `type`, `leadId`, `startDate`, `endDate`, `limit`.

- [ ] **Step 1: Write the failing test**

Create `e2e/tests/team-activity-api.spec.ts`:

```ts
import { test, expect, loadSeedData } from '../fixtures'
import { mintTestJwt, apiFetch } from '../helpers/api'

/**
 * Exercises the GET /api/activities filters. Activities are created via the API
 * as the admin and the sales user, then read back with various filters.
 * Auth uses minted JWTs (no login form → no rate limiter).
 */
test.describe('Team activity API filters', () => {
  test('admin sees all members; ownerId filters to one member; sales is scoped to self', async () => {
    const seed = loadSeedData()
    const { dok } = seed.tenants
    const { dokAdmin, dokSales } = seed.users
    const sub = dok.subdomain

    const adminToken = mintTestJwt({ userId: dokAdmin.id, tenantId: dok.id, role: 'admin', email: dokAdmin.email, plan: 'starter' })
    const salesToken = mintTestJwt({ userId: dokSales.id, tenantId: dok.id, role: 'sales', email: dokSales.email, plan: 'starter' })

    // Create one activity as admin and one as sales
    const mkAdmin = await apiFetch('/api/activities', adminToken, sub, {
      method: 'POST',
      body: JSON.stringify({ type: 'call', description: 'TA admin call' }),
    })
    expect(mkAdmin.status).toBe(201)
    const mkSales = await apiFetch('/api/activities', salesToken, sub, {
      method: 'POST',
      body: JSON.stringify({ type: 'meeting', description: 'TA sales meeting' }),
    })
    expect(mkSales.status).toBe(201)

    // Admin, no filter → sees both members' activities
    const allRes = await apiFetch('/api/activities', adminToken, sub)
    const all = await allRes.json()
    const allOwners = new Set(all.map((a: { ownerId: string }) => a.ownerId))
    expect(allOwners.has(dokAdmin.id)).toBeTruthy()
    expect(allOwners.has(dokSales.id)).toBeTruthy()

    // Admin, ownerId = sales → only sales' activities
    const oneRes = await apiFetch(`/api/activities?ownerId=${dokSales.id}`, adminToken, sub)
    const one = await oneRes.json()
    expect(one.length).toBeGreaterThan(0)
    expect(one.every((a: { ownerId: string }) => a.ownerId === dokSales.id)).toBeTruthy()

    // Sales passing admin's ownerId → still only own activities (IDOR guard)
    const sneakRes = await apiFetch(`/api/activities?ownerId=${dokAdmin.id}`, salesToken, sub)
    const sneak = await sneakRes.json()
    expect(sneak.every((a: { ownerId: string }) => a.ownerId === dokSales.id)).toBeTruthy()
  })

  test('type filter narrows results and invalid type is rejected', async () => {
    const seed = loadSeedData()
    const { dok } = seed.tenants
    const { dokAdmin } = seed.users
    const sub = dok.subdomain
    const token = mintTestJwt({ userId: dokAdmin.id, tenantId: dok.id, role: 'admin', email: dokAdmin.email, plan: 'starter' })

    const typed = await apiFetch('/api/activities?type=meeting', token, sub)
    expect(typed.status).toBe(200)
    const rows = await typed.json()
    expect(rows.every((a: { type: string }) => a.type === 'meeting')).toBeTruthy()

    const bad = await apiFetch('/api/activities?type=bogus', token, sub)
    expect(bad.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd e2e && npx playwright test tests/team-activity-api.spec.ts`
Expected: FAIL — the `type=bogus` case returns 200 (no validation yet) and/or the `ownerId` filter returns all rows because the param is ignored.

- [ ] **Step 3: Extend the model**

In `backend/src/models/activityModel.ts`, add the filters interface above the query functions and replace `findAllActivities`:

```ts
export interface ActivityFilters {
  ownerId?:   string;
  type?:      string;
  leadId?:    string;
  startDate?: string;
  endDate?:   string;
  limit?:     number;
}

export async function findAllActivities(
  userId: string,
  tenantId: string,
  isAdmin: boolean,
  filters: ActivityFilters = {}
) {
  const conditions: string[] = ['a.tenant_id = $1'];
  const params: unknown[] = [tenantId];
  let i = 2;

  // Non-admins are always restricted to their own activities, regardless of filters.
  if (!isAdmin) {
    conditions.push(`a.owner_id = $${i++}`); params.push(userId);
  } else if (filters.ownerId) {
    conditions.push(`a.owner_id = $${i++}`); params.push(filters.ownerId);
  }
  if (filters.type)      { conditions.push(`a.type = $${i++}`);        params.push(filters.type); }
  if (filters.leadId)    { conditions.push(`a.lead_id = $${i++}`);     params.push(filters.leadId); }
  if (filters.startDate) { conditions.push(`a.created_at >= $${i++}`); params.push(filters.startDate); }
  if (filters.endDate)   { conditions.push(`a.created_at <= $${i++}`); params.push(filters.endDate); }

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  params.push(limit);
  const limitPlaceholder = `$${i}`;

  const result = await query(
    `SELECT a.*, u.display_name AS owner_name
       FROM activities a
       LEFT JOIN users u ON u.id = a.owner_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT ${limitPlaceholder}`,
    params
  );
  return result.rows.map(mapActivity);
}
```

- [ ] **Step 4: Update the controller**

In `backend/src/controllers/activityController.ts`, add validation constants near the top (after the imports / `MANUAL_TYPES`):

```ts
const ALL_ACTIVITY_TYPES: readonly string[] = ['note', 'stage_change', 'call', 'email', 'meeting'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

Replace `listActivities` with:

```ts
export async function listActivities(req: Request, res: Response) {
  try {
    const { ownerId, type, leadId, startDate, endDate, limit } =
      req.query as Record<string, string | undefined>;

    if (type && !ALL_ACTIVITY_TYPES.includes(type)) {
      res.status(400).json({ error: 'Invalid activity type' }); return;
    }
    if (ownerId && !UUID_RE.test(ownerId)) {
      res.status(400).json({ error: 'Invalid ownerId' }); return;
    }
    if (leadId && !UUID_RE.test(leadId)) {
      res.status(400).json({ error: 'Invalid leadId' }); return;
    }
    if (startDate && isNaN(Date.parse(startDate))) {
      res.status(400).json({ error: 'Invalid startDate' }); return;
    }
    if (endDate && isNaN(Date.parse(endDate))) {
      res.status(400).json({ error: 'Invalid endDate' }); return;
    }
    let parsedLimit: number | undefined;
    if (limit !== undefined) {
      parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        res.status(400).json({ error: 'Invalid limit' }); return;
      }
    }

    const isAdmin = req.user!.role === 'admin';
    const activities = await findAllActivities(
      req.user!.userId,
      req.user!.tenantId,
      isAdmin,
      {
        // Non-admins must never filter by another member; force undefined so the
        // model's own-owner restriction applies.
        ownerId: isAdmin ? ownerId : undefined,
        type, leadId, startDate, endDate, limit: parsedLimit,
      }
    );
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

Update the import at the top of the controller to include the type:

```ts
import { findAllActivities, findActivitiesByLead, createActivity } from '../models/activityModel';
```

(no change needed if already importing `findAllActivities`; `ActivityFilters` is used only inside the model).

- [ ] **Step 5: Rebuild the backend and restart the container**

Run:
```bash
cd backend && npm run build
cd "d:/Project/Sale Funnel" && docker compose up -d --build backend
```
Expected: `tsc` exits with no output; backend container reports healthy.

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd e2e && npx playwright test tests/team-activity-api.spec.ts`
Expected: PASS (all cases green).

- [ ] **Step 7: Commit**

```bash
git add backend/src/models/activityModel.ts backend/src/controllers/activityController.ts e2e/tests/team-activity-api.spec.ts
git commit -m "feat(activities): add member/type/date/lead filters to GET /api/activities"
```

---

### Task 2: Frontend — Team Activity page

**Files:**
- Modify: `frontend/src/services/activityService.ts` (filter-aware `getActivities`)
- Create: `frontend/src/pages/admin/TeamActivity.tsx`
- Modify: `frontend/src/App.tsx` (add guarded route)
- Modify: `frontend/src/components/layout/Sidebar.tsx` (add admin nav item)
- Test: `e2e/tests/team-activity-page.spec.ts` (create)

**Interfaces:**
- Consumes: `getActivities(filters?)` and `ActivityFilters` from `services/activityService`; `getAllUsers` from `services/userService`; `Activity`, `User` from `@/types`; `Card`/`CardContent`/`CardHeader`/`CardTitle` from `@/components/ui/card`; `Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem` from `@/components/ui/select`; `RoleGuard` from existing usage in `App.tsx`; `formatRelativeTime` from `@/lib/utils/formatters`.
- Produces: route `/team-activity`; nav link to it; the page is exported as `export function TeamActivity()`.

- [ ] **Step 1: Write the failing test**

Create `e2e/tests/team-activity-page.spec.ts`:

```ts
import { test, expect, loadSeedData } from '../fixtures'
import { mintTestJwt, apiFetch } from '../helpers/api'

async function authedTeamActivityPage(
  browser: import('@playwright/test').Browser,
  subdomain: string, userId: string, tenantId: string, role: string, email: string,
) {
  const token = mintTestJwt({ userId, tenantId, role, email, plan: 'starter' })
  const ctx = await browser.newContext()
  await ctx.route('**/api/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'X-Tenant-Subdomain': subdomain } }))
  await ctx.addCookies([{ name: 'auth_token', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }])
  const page = await ctx.newPage()
  await page.goto('/team-activity')
  return { page, ctx, token }
}

test.describe('Team Activity page', () => {
  test('admin sees the page heading and a logged activity', async ({ browser }) => {
    const seed = loadSeedData()
    const { dok } = seed.tenants
    const { dokAdmin } = seed.users
    const { page, ctx, token } = await authedTeamActivityPage(
      browser, dok.subdomain, dokAdmin.id, dok.id, 'admin', dokAdmin.email)
    try {
      // Seed an activity through the API so there is something to show
      await apiFetch('/api/activities', token, dok.subdomain, {
        method: 'POST',
        body: JSON.stringify({ type: 'call', description: 'Page test call activity' }),
      })
      await page.reload()
      await expect(page.getByTestId('team-activity-page')).toBeVisible()
      await expect(page.getByText('Page test call activity')).toBeVisible()
    } finally {
      await ctx.close()
    }
  })

  test('sales user is redirected away from the admin page', async ({ browser }) => {
    const seed = loadSeedData()
    const { dok } = seed.tenants
    const { dokSales } = seed.users
    const { page, ctx } = await authedTeamActivityPage(
      browser, dok.subdomain, dokSales.id, dok.id, 'sales', dokSales.email)
    try {
      // RoleGuard should keep the admin page hidden from a sales user
      await expect(page.getByTestId('team-activity-page')).toHaveCount(0)
    } finally {
      await ctx.close()
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd e2e && npx playwright test tests/team-activity-page.spec.ts`
Expected: FAIL — `/team-activity` route does not exist, so `team-activity-page` testid is never found.

- [ ] **Step 3: Make `getActivities` filter-aware**

Replace the `getActivities` export in `frontend/src/services/activityService.ts` (keep the other exports):

```ts
import { apiFetch } from './apiClient';
import type { Activity } from '../models';

export interface ActivityFilters {
  ownerId?:   string;
  type?:      string;
  leadId?:    string;
  startDate?: string;
  endDate?:   string;
  limit?:     number;
}

export const getActivities = (filters: ActivityFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.ownerId)        params.set('ownerId', filters.ownerId);
  if (filters.type)           params.set('type', filters.type);
  if (filters.leadId)         params.set('leadId', filters.leadId);
  if (filters.startDate)      params.set('startDate', filters.startDate);
  if (filters.endDate)        params.set('endDate', filters.endDate);
  if (filters.limit != null)  params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiFetch<Activity[]>(`/api/activities${qs ? `?${qs}` : ''}`);
};

export const getActivitiesByLead = (leadId: string) =>
  apiFetch<Activity[]>(`/api/activities/lead/${leadId}`);

export const createActivity = (data: Omit<Activity, 'id' | 'createdAt'>) =>
  apiFetch<Activity>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
```

(Backward compatible: `RecentActivities` calls `getActivities()` with no args.)

- [ ] **Step 4: Create the page**

Create `frontend/src/pages/admin/TeamActivity.tsx`:

```tsx
import { useState, useEffect, useMemo } from 'react'
import { Phone, Mail, Calendar, FileText, ArrowRight, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { getActivities, type ActivityFilters } from '@/services/activityService'
import { getAllUsers } from '@/services/userService'
import { Activity, User } from '@/types'
import { formatRelativeTime } from '@/lib/utils/formatters'

const activityIcons: Record<string, typeof Phone> = {
  note: MessageSquare, stage_change: ArrowRight, call: Phone, email: Mail, meeting: Calendar,
}
const activityColors: Record<string, string> = {
  note: 'bg-blue-100 text-blue-600',
  stage_change: 'bg-purple-100 text-purple-600',
  call: 'bg-green-100 text-green-600',
  email: 'bg-orange-100 text-orange-600',
  meeting: 'bg-pink-100 text-pink-600',
}

type DatePreset = 'all' | 'today' | 'week' | 'month'

function presetRange(preset: DatePreset): { startDate?: string; endDate?: string } {
  if (preset === 'all') return {}
  const now = new Date()
  const start = new Date(now)
  if (preset === 'today')      start.setHours(0, 0, 0, 0)
  else if (preset === 'week')  start.setDate(now.getDate() - 7)
  else if (preset === 'month') start.setMonth(now.getMonth() - 1)
  return { startDate: start.toISOString() }
}

export function TeamActivity() {
  const [members, setMembers] = useState<User[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [memberId, setMemberId] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('month')

  useEffect(() => {
    getAllUsers().then(setMembers).catch(err => console.error('Failed to load members', err))
  }, [])

  useEffect(() => {
    setIsLoading(true)
    const filters: ActivityFilters = {
      ...(memberId !== 'all' && { ownerId: memberId }),
      ...(type !== 'all' && { type }),
      ...presetRange(datePreset),
    }
    getActivities(filters)
      .then(setActivities)
      .catch(err => console.error('Failed to load activities', err))
      .finally(() => setIsLoading(false))
  }, [memberId, type, datePreset])

  const grouped = useMemo(() => {
    const byDay: Record<string, Activity[]> = {}
    for (const a of activities) {
      const day = a.createdAt ? new Date(a.createdAt).toDateString() : 'Unknown'
      ;(byDay[day] ??= []).push(a)
    }
    return Object.entries(byDay)
  }, [activities])

  return (
    <div className="space-y-6" data-testid="team-activity-page">
      <div>
        <h1 className="text-2xl font-bold">Team Activity</h1>
        <p className="text-sm text-muted-foreground">See what each team member has logged.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Member" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.displayName || m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="stage_change">Stage change</SelectItem>
          </SelectContent>
        </Select>

        <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" /> Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activities match these filters.</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([day, items]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-muted-foreground mb-3">{day}</p>
                  <div className="space-y-4">
                    {items.map((a) => {
                      const Icon = activityIcons[a.type] || FileText
                      const color = activityColors[a.type] || 'bg-gray-100 text-gray-600'
                      return (
                        <div key={a.id} className="flex gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{a.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.ownerName || 'Unknown'} · {a.createdAt ? formatRelativeTime(a.createdAt) : ''}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Register the route**

In `frontend/src/App.tsx`, add the import next to the other admin-page imports:

```tsx
import { TeamActivity } from '@/pages/admin/TeamActivity'
```

Add this route inside the `{/* Admin-only routes */}` block (e.g. right after the `rep-comparison` route):

```tsx
        <Route
          path="team-activity"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <TeamActivity />
            </RoleGuard>
          }
        />
```

- [ ] **Step 6: Add the sidebar nav item**

In `frontend/src/components/layout/Sidebar.tsx`, add `Activity` to the existing `lucide-react` import line, then add this entry as the first item of `adminNavItems` (before `rep-comparison`):

```tsx
    {
      to: '/team-activity',
      icon: <Activity className="h-5 w-5 flex-shrink-0" />,
      label: 'Team Activity',
    },
```

- [ ] **Step 7: Rebuild the frontend container**

Run:
```bash
cd "d:/Project/Sale Funnel" && docker compose up -d --build frontend
```
Expected: frontend image rebuilds; container becomes healthy.

- [ ] **Step 8: Run the test to verify it passes**

Run: `cd e2e && npx playwright test tests/team-activity-page.spec.ts`
Expected: PASS — admin sees the heading + the seeded activity; the sales user never sees the `team-activity-page` testid.

- [ ] **Step 9: Typecheck the frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/services/activityService.ts frontend/src/pages/admin/TeamActivity.tsx frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx e2e/tests/team-activity-page.spec.ts
git commit -m "feat(activities): add admin Team Activity page with member/type/date filters"
```

---

## Self-Review

**Spec coverage:**
- Admin views all members' activities → Task 1 (model/controller) + Task 2 (page). ✓
- Filter by member / type / date / lead → Task 1 query params (`ownerId`, `type`, `startDate`/`endDate`, `leadId`); Task 2 surfaces member/type/date in the UI. The `leadId` filter is implemented and tested at the API level; the page does not yet expose a lead picker UI (the spec lists it; deferred to a follow-up to keep the page focused — member/type/date are the primary controls). **Note for implementer:** if a lead picker is wanted in v1, add a fourth `Select` populated from `getLeads()` setting `leadId` — the endpoint already supports it.
- Admins only; sales scoped to self → RoleGuard on the route + model forcing `owner_id = caller` for non-admins; covered by both API and page tests. ✓
- Each entry shows who/what/lead/when → page renders description, `ownerName`, relative time. (Lead/company name per row is available via the activity's `leadId`; a follow-up can join the lead name into the row — current rows show description + member + time.)
- Non-goals (no notifications, no export, sales unchanged) → respected. ✓

**Placeholder scan:** No TBD/TODO; all code blocks are complete; all commands have expected output. ✓

**Type consistency:** `ActivityFilters` defined identically in backend model and frontend service; `findAllActivities` 4-arg signature used consistently; `getActivities(filters?)` backward-compatible with existing `RecentActivities` call; `Activity.ownerName` exists in the frontend model (`models/index.ts`). ✓

**Scope note:** Two requirements from the spec are intentionally narrowed in v1 and flagged above for the implementer: the **lead/company filter** is backend-complete but not surfaced in the page UI, and **per-row lead name** is not yet displayed. Both are small additive follow-ups and do not block the core "see each member's activity" goal. If you want them in v1, say so and I'll fold them into Task 2 before execution.
