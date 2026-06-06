# Phase 4 — License Enforcement: Design Spec

**Date:** 2026-04-24
**Project:** DOK CRM SaaS
**Phase:** 4 of 8
**Status:** Approved — ready for implementation

---

## 1. Overview

Enforce per-tenant user seat limits based on plan. Prevent tenants from exceeding their
purchased user count without DOK manually raising their limit or upgrading their plan.

---

## 2. Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Enforcement scope | Create AND re-activate | Re-activating a deactivated user consumes a seat; blocking only creation creates a loophole |
| Enterprise exemption | Skip check entirely | Enterprise plan = unlimited seats |
| Error code | `USER_LIMIT_REACHED` | Machine-readable, distinct from other 403s |
| Frontend trigger | Check `err.message === 'USER_LIMIT_REACHED'` | No change to `apiFetch`; error code propagates as message string |
| Plan info in dialog | Read from `useAuthStore()` | Plan is already in the JWT payload and auth state |

---

## 3. Plan Limits

| Plan | User Limit | Enforcement |
|------|-----------|-------------|
| starter | 3 (or SA-configured value) | Enforced |
| business | 10 (or SA-configured value) | Enforced |
| enterprise | unlimited | Skipped |

Actual limit is always read from `tenants.user_limit` (set by SA), not hardcoded by plan name.
The `enterprise` plan is the only special case — it bypasses enforcement regardless of `user_limit`.

---

## 4. Backend

### 4.1 Enforcement Logic — `userController.ts`

**Shared helper (inline, not exported):**

```typescript
async function checkUserLimit(tenantId: string, plan: string): Promise<{
  allowed: boolean
  currentCount: number
  limit: number
}> {
  if (plan === 'enterprise') return { allowed: true, currentCount: 0, limit: -1 }
  const tenant = await findTenantById(tenantId)
  if (!tenant) return { allowed: true, currentCount: 0, limit: -1 }
  const currentCount = await countUsersInTenant(tenantId)
  return { allowed: currentCount < tenant.userLimit, currentCount, limit: tenant.userLimit }
}
```

**`createUserHandler` — add before hashing password:**

```typescript
const check = await checkUserLimit(req.user!.tenantId, req.user!.plan)
if (!check.allowed) {
  res.status(403).json({
    error: 'USER_LIMIT_REACHED',
    message: `Your ${req.user!.plan} plan allows ${check.limit} users. Contact support to add more licences.`,
    currentCount: check.currentCount,
    limit: check.limit,
    plan: req.user!.plan,
  })
  return
}
```

**`updateUserHandler` — add when `isActive === true` is being set:**

```typescript
if (body.isActive === true) {
  // Only check if the user is currently inactive (re-activation path)
  const existing = await findUserById(req.params.id)
  if (existing && !existing.isActive) {
    const check = await checkUserLimit(req.user!.tenantId, req.user!.plan)
    if (!check.allowed) {
      res.status(403).json({
        error: 'USER_LIMIT_REACHED',
        message: `Your ${req.user!.plan} plan allows ${check.limit} users. Contact support to add more licences.`,
        currentCount: check.currentCount,
        limit: check.limit,
        plan: req.user!.plan,
      })
      return
    }
  }
}
```

### 4.2 Error Response Shape

```json
{
  "error": "USER_LIMIT_REACHED",
  "message": "Your starter plan allows 3 users. Contact support to add more licences.",
  "currentCount": 3,
  "limit": 3,
  "plan": "starter"
}
```

HTTP status: `403 Forbidden`

### 4.3 Existing Model Functions Used (no new functions needed)

- `findTenantById(tenantId)` — `backend/src/models/tenantModel.ts`
- `countUsersInTenant(tenantId)` — `backend/src/models/tenantModel.ts`
- `findUserById(id)` — `backend/src/models/userModel.ts`

---

## 5. Frontend

### 5.1 Changes to `TeamManagement.tsx`

Add a new state variable:

```typescript
const [limitReached, setLimitReached] = useState(false)
```

**Catch in add-user flow** (around `createUserProfile` call):

```typescript
} catch (err) {
  if (err instanceof Error && err.message === 'USER_LIMIT_REACHED') {
    setLimitReached(true)
  } else {
    toast.error('Failed to create user')
  }
}
```

**Catch in re-activate flow** (around `updateUserStatus(id, true)` call):

```typescript
} catch (err) {
  if (err instanceof Error && err.message === 'USER_LIMIT_REACHED') {
    setLimitReached(true)
  } else {
    toast.error('Failed to update user status')
  }
}
```

### 5.2 User Limit Reached Dialog

Shown when `limitReached === true`. Uses existing shadcn `AlertDialog`.

```
User Limit Reached
──────────────────────────────────────────
Your [plan] plan has reached its user limit.
To add more users, contact DOK support to
upgrade your plan or add an extra licence.

              [Contact Support]  [Close]
```

- "Contact Support" → `window.open('mailto:support@dokcrm.com')`
- "Close" → `setLimitReached(false)`
- Plan name read from `useAuthStore().userProfile?.plan`

---

## 6. Files to Create / Modify

### Modified Files Only (no new files)

| File | Change |
|------|--------|
| `backend/src/controllers/userController.ts` | Add `checkUserLimit` helper + enforcement in `createUserHandler` and `updateUserHandler` |
| `frontend/src/pages/admin/TeamManagement.tsx` | Add `limitReached` state, catch `USER_LIMIT_REACHED` in create + re-activate flows, add limit dialog |

---

## 7. What is NOT in Phase 4

- Blocking the SA `createTenant` flow (SA sets user_limit explicitly — no enforcement needed)
- Proactive UI showing "X of Y seats used" in TeamManagement (Phase 7+)
- Email notification when approaching limit (Phase 7+)
- Automatic plan upgrade flow (future)
