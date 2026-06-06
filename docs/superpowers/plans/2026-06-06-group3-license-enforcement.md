# Group 3: License Enforcement + Customization Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce trial expiry and lead count limits so tenants can't use the app after their trial ends or after they exceed their plan's lead cap, and validate required custom fields on lead creation/update.

**Architecture:**
- Trial expiry: `resolveTenant` middleware lazily transitions `status = 'suspended'` when `trial_ends_at` is past and returns 402. Frontend's `apiFetch` intercepts 402 and redirects to a "trial expired" page.
- Lead limits: migration adds `lead_limit` column; `createLeadHandler` counts active leads and blocks at the cap.
- Required custom fields: `createLeadHandler` / `updateLeadHandler` load tenant config and reject if required custom field values are missing.

**Tech Stack:** Express + PostgreSQL (backend), React 18 + TypeScript (frontend), existing `query()` / `apiFetch` patterns.

> **Feature 10 (Wildcard SSL + Subdomain Routing)** is server/nginx infrastructure — not implemented here. Requires DNS wildcard setup and nginx `server_name *.yourdomain.com` config on the production host.

---

## File Map

**Task 1 — Trial Expiry Enforcement**
- Modify: `backend/src/middleware/tenantResolver.ts` — check `trial_ends_at < NOW()` and return 402
- Modify: `frontend/src/config/api.ts` — intercept 402, throw a typed error
- Create: `frontend/src/pages/auth/TrialExpiredPage.tsx` — full-screen notice
- Modify: `frontend/src/App.tsx` (or router file) — catch `TRIAL_EXPIRED` and render the page

**Task 2 — Lead Count Limit**
- Create: `backend/migrations/019_add_lead_limit.sql` — add `lead_limit` column
- Modify: `backend/src/models/leadModel.ts` — add `countActiveLeads(tenantId)`
- Modify: `backend/src/controllers/leadController.ts` — enforce limit in `createLeadHandler`

**Task 3 — Required Custom Field Validation**
- Modify: `backend/src/controllers/leadController.ts` — validate required custom fields in `createLeadHandler` and `updateLeadHandler`

---

## Task 1: Trial Expiry Enforcement

**Files:**
- Modify: `backend/src/middleware/tenantResolver.ts`
- Modify: `frontend/src/config/api.ts`
- Create: `frontend/src/pages/auth/TrialExpiredPage.tsx`
- Modify: `frontend/src/App.tsx` (or router entry — check actual file)

### Step 1: Add trial expiry check to resolveTenant

Open `backend/src/middleware/tenantResolver.ts`.

After the block that sets `req.tenant = tenant` (and before `return next()`), add a check in both the subdomain path and the `x-tenant-id` dev path. The pattern is: after finding a tenant with `status === 'trial'`, check if the trial has ended.

Find every `req.tenant = tenant; return next()` path inside `resolveTenant` (NOT in `resolveTenantOptional`) and add the expiry check immediately before `return next()`:

```typescript
// At the top of the file, add this import if not already present:
import { updateTenant } from '../models/tenantModel';
```

Then for each path in `resolveTenant` that assigns `req.tenant = tenant` and calls `next()`:

```typescript
// After: req.tenant = tenant
// Before: return next()

// Check trial expiry
if (tenant.status === 'trial' && tenant.trialEndsAt && tenant.trialEndsAt < new Date()) {
  await updateTenant(tenant.id, { status: 'suspended' });
  res.status(402).json({
    error: 'TRIAL_EXPIRED',
    message: 'Your trial has ended. Please contact support to upgrade your plan.',
  });
  return;
}
```

> **Note:** `updateTenant` is already imported indirectly via tenantModel — check the import at the top of the file. If only `findTenantBySubdomain` and `findTenantById` are imported, add `updateTenant` to that import line.

> **Why lazy update:** marking the tenant suspended when they first hit the endpoint keeps DB state consistent without needing a cron job. Subsequent requests will then hit the `status !== 'active' && status !== 'trial'` guard at the top of `resolveTenant` and return 404.

### Step 2: Verify backend TypeScript

```powershell
cd "D:\Project\Sale Funnel\backend"; npx tsc --noEmit
```

Expected: zero errors.

### Step 3: Commit backend change

```powershell
cd "D:\Project\Sale Funnel"
git add backend/src/middleware/tenantResolver.ts
git commit -m "feat(license): enforce trial expiry in tenant resolver — lazily suspend on first API call after expiry"
```

### Step 4: Intercept 402 in apiFetch

Open `frontend/src/config/api.ts`. Replace the `if (!res.ok)` block:

```typescript
export class TrialExpiredError extends Error {
  constructor() {
    super('TRIAL_EXPIRED')
    this.name = 'TrialExpiredError'
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 402) {
    throw new TrialExpiredError()
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

### Step 5: Create TrialExpiredPage

Create `frontend/src/pages/auth/TrialExpiredPage.tsx`:

```tsx
export function TrialExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <div className="text-6xl">⏰</div>
        <h1 className="text-2xl font-bold">Your trial has ended</h1>
        <p className="text-muted-foreground">
          Your free trial period has expired. To continue using CRM Stack,
          please contact support to upgrade your plan.
        </p>
        <a
          href="mailto:support@crmstack.com"
          className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Contact Support
        </a>
      </div>
    </div>
  )
}
```

### Step 6: Handle TrialExpiredError in the app

First, find the router/App entry: check `frontend/src/App.tsx` and `frontend/src/main.tsx` to see where routes are defined and where global error handling lives.

In the main query/fetch error boundary or in the global error handler, add a check for `TrialExpiredError`. The simplest approach: add a `trialExpired` state to the auth store (or a standalone boolean in a new store), set it when `TrialExpiredError` is caught, and render `<TrialExpiredPage />` when true.

Open the auth store (likely `frontend/src/store/authStore.ts`). Add:
```typescript
trialExpired: false,
setTrialExpired: () => set({ trialExpired: true }),
```

In the root component (App.tsx), read `trialExpired` and render the page:
```tsx
import { useAuthStore } from '@/store/authStore'
import { TrialExpiredPage } from '@/pages/auth/TrialExpiredPage'

// Inside App component, before the router:
const trialExpired = useAuthStore(s => s.trialExpired)
if (trialExpired) return <TrialExpiredPage />
```

In the global error handler (or in a React error boundary), set it when `TrialExpiredError` is caught. If there is no global error boundary, add a window-level unhandled rejection handler in `main.tsx`:
```typescript
import { TrialExpiredError } from './config/api'
import { useAuthStore } from './store/authStore'

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof TrialExpiredError) {
    useAuthStore.getState().setTrialExpired(true)
    event.preventDefault()
  }
})
```

> **Verify exact store/file names:** Read `frontend/src/store/authStore.ts` to confirm the store shape before editing. Adjust the implementation to match the existing store pattern.

### Step 7: Verify frontend TypeScript

```powershell
cd "D:\Project\Sale Funnel\frontend"; npx tsc --noEmit
```

Expected: zero errors.

### Step 8: Commit frontend changes

```powershell
cd "D:\Project\Sale Funnel"
git add frontend/src/config/api.ts frontend/src/pages/auth/TrialExpiredPage.tsx frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat(license): show trial expired page when API returns 402"
```

---

## Task 2: Lead Count Limit

**Files:**
- Create: `backend/migrations/019_add_lead_limit.sql`
- Modify: `backend/src/models/leadModel.ts`
- Modify: `backend/src/controllers/leadController.ts`

### Step 1: Create migration

Create `backend/migrations/019_add_lead_limit.sql`:

```sql
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS lead_limit INTEGER DEFAULT NULL;

-- Set per-plan defaults for existing tenants
-- NULL = unlimited (enterprise)
UPDATE tenants SET lead_limit = 500  WHERE plan = 'starter'    AND lead_limit IS NULL;
UPDATE tenants SET lead_limit = 5000 WHERE plan = 'business'   AND lead_limit IS NULL;
-- enterprise stays NULL (unlimited)
```

Run:
```powershell
cd "D:\Project\Sale Funnel\backend"; npm run migrate
```

Expected: `✅ 019_add_lead_limit.sql`

> **If npm run migrate doesn't work with the Docker DB**, run via Docker:
> ```powershell
> docker compose exec postgres psql -U crmstack -d crmstack -f /dev/stdin < backend/migrations/019_add_lead_limit.sql
> ```
> Then check: `docker compose exec postgres psql -U crmstack -d crmstack -c "\d tenants"` — `lead_limit` column should appear.

### Step 2: Add countActiveLeads to tenantModel

Open `backend/src/models/tenantModel.ts`. Add this function at the end:

```typescript
export async function countActiveLeads(tenantId: string): Promise<number> {
  const result = await query(
    'SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE',
    [tenantId]
  );
  return parseInt(result.rows[0].count, 10);
}
```

Also update the `Tenant` interface to include `leadLimit`:

```typescript
export interface Tenant {
  id:           string;
  name:         string;
  subdomain:    string;
  plan:         'starter' | 'business' | 'enterprise';
  status:       'active' | 'trial' | 'suspended' | 'cancelled';
  userLimit:    number;
  leadLimit:    number | null;   // ADD THIS — null = unlimited
  ownerEmail:   string;
  createdAt:    Date;
  suspendedAt:  Date | null;
  trialEndsAt:  Date | null;
}
```

Update `mapTenant` to include `leadLimit`:
```typescript
export const mapTenant = (row: Record<string, unknown>): Tenant => ({
  id:          row.id as string,
  name:        row.name as string,
  subdomain:   row.subdomain as string,
  plan:        row.plan as Tenant['plan'],
  status:      row.status as Tenant['status'],
  userLimit:   row.user_limit as number,
  leadLimit:   row.lead_limit as number | null,   // ADD THIS
  ownerEmail:  row.owner_email as string,
  createdAt:   row.created_at as Date,
  suspendedAt: row.suspended_at as Date | null,
  trialEndsAt: row.trial_ends_at as Date | null,
});
```

### Step 3: Enforce lead limit in createLeadHandler

Open `backend/src/controllers/leadController.ts`.

Add import at the top (merge into existing tenantModel import if one exists, or add new):
```typescript
import { countActiveLeads } from '../models/tenantModel';
```

In `createLeadHandler`, after the `validateLeadFields` check and before `const actualOwnerId = ...`, add:

```typescript
  // Lead count limit check
  if (req.tenant?.leadLimit != null) {
    const currentCount = await countActiveLeads(req.user!.tenantId)
    if (currentCount >= req.tenant.leadLimit) {
      res.status(403).json({
        error: 'LEAD_LIMIT_REACHED',
        message: `Your plan allows up to ${req.tenant.leadLimit} leads. Please upgrade to add more.`,
        limit: req.tenant.leadLimit,
        current: currentCount,
      })
      return
    }
  }
```

> **Note on `req.tenant`:** `resolveTenant` runs before all authenticated routes and sets `req.tenant`. It is safe to access here. `req.tenant?.leadLimit` is `null` for enterprise (unlimited) — the `!= null` guard correctly skips the check.

### Step 4: Verify backend TypeScript

```powershell
cd "D:\Project\Sale Funnel\backend"; npx tsc --noEmit
```

Fix any TypeScript errors (most likely: places that destructure `Tenant` and don't include `leadLimit` — just add the optional field).

### Step 5: Commit

```powershell
cd "D:\Project\Sale Funnel"
git add backend/migrations/019_add_lead_limit.sql backend/src/models/tenantModel.ts backend/src/controllers/leadController.ts
git commit -m "feat(license): add per-plan lead count limit with enforcement on lead creation"
```

---

## Task 3: Required Custom Field Validation

**Files:**
- Modify: `backend/src/controllers/leadController.ts`

### Step 1: Add validateRequiredCustomFields helper

Open `backend/src/controllers/leadController.ts`.

Add this import near the top (with other model imports):
```typescript
import { findConfigByTenantId } from '../models/tenantConfigModel';
```

Add this helper function just below `validateLeadFields`:

```typescript
async function validateRequiredCustomFields(
  tenantId: string,
  customFields: Record<string, unknown>
): Promise<string | null> {
  const config = await findConfigByTenantId(tenantId)
  if (!config) return null
  for (const field of config.customFields) {
    if (!field.required) continue
    const value = customFields[field.id]
    const isEmpty =
      value == null ||
      (typeof value === 'string' && value.trim() === '') ||
      (field.type === 'checkbox' && value === false)
    if (isEmpty) {
      return `"${field.name}" is required`
    }
  }
  return null
}
```

### Step 2: Call it in createLeadHandler

In `createLeadHandler`, after the existing `validateLeadFields` block, add:

```typescript
  const customFieldsToValidate = (customFields as Record<string, unknown>) || {}
  const cfError = await validateRequiredCustomFields(req.user!.tenantId, customFieldsToValidate)
  if (cfError) {
    res.status(400).json({ error: cfError })
    return
  }
```

Place this block before `const actualOwnerId = ...`.

### Step 3: Call it in updateLeadHandler

In `updateLeadHandler`, find the existing `const validationError = validateLeadFields(req.body)` block. After it, add:

```typescript
  // Validate required custom fields if provided in the update
  if (customFields != null) {
    const merged = {
      ...(existingLead.customFields as Record<string, unknown> ?? {}),
      ...(customFields as Record<string, unknown>),
    }
    const cfError = await validateRequiredCustomFields(req.user!.tenantId, merged)
    if (cfError) {
      res.status(400).json({ error: cfError })
      return
    }
  }
```

> **Why merge?** A PATCH update only sends the fields being changed. If a required field is already set in the existing lead and not included in the update body, we should not reject it. Merging ensures we validate the final state, not just the delta.

> **Where to place this:** After `const existingLead = await findLeadById(...)` (it must exist before we can merge) and after the existing `validateLeadFields` call.

### Step 4: Verify TypeScript

```powershell
cd "D:\Project\Sale Funnel\backend"; npx tsc --noEmit
```

Expected: zero errors.

### Step 5: Commit

```powershell
cd "D:\Project\Sale Funnel"
git add backend/src/controllers/leadController.ts
git commit -m "feat(leads): validate required custom fields on lead create and update"
```
