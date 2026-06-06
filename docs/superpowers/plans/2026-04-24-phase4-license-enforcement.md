# Phase 4 — License Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block tenant admins from adding users (create or re-activate) beyond their plan's seat limit.

**Architecture:** Two enforcement points in `userController.ts` — both call a shared inline helper that reads tenant `user_limit` from the DB and counts active users. The frontend catches the `USER_LIMIT_REACHED` error code and shows a dedicated dialog instead of a generic toast.

**Tech Stack:** Express + TypeScript (backend), React 18 + Zustand + shadcn/ui (frontend)

**Note:** This project is NOT a git repository — skip all git/commit steps.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `backend/src/controllers/userController.ts` | Modify | Add `checkUserLimit` helper + enforcement in `createUserHandler` + `updateUserHandler` |
| `frontend/src/pages/admin/TeamManagement.tsx` | Modify | Add `limitReached` state, catch `USER_LIMIT_REACHED` in create + toggle flows, add limit dialog |

---

### Task 1: Backend — User Limit Enforcement

**Files:**
- Modify: `backend/src/controllers/userController.ts`

**Context on the existing file (`backend/src/controllers/userController.ts`):**

```typescript
// Current imports (top of file):
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  findAllUsers, findSalesUsers, findUserById,
  createUser, updateUser, updateUserPassword,
} from '../models/userModel';

// createUserHandler (line 43) — currently no limit check
export async function createUserHandler(req: Request, res: Response) {
  const { email, username, displayName, password, role } = req.body;
  // ... validation ...
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ ... });
    res.status(201).json(user);
  } catch (err: unknown) { ... }
}

// updateUserHandler (line 65) — currently no limit check
export async function updateUserHandler(req: Request, res: Response) {
  const { displayName, role, isActive, password } = req.body;
  try {
    if (password) { ... }
    const user = await updateUser(req.params.id, { displayName, role, isActive });
    ...
  }
}
```

**Context on model functions already available:**
- `findTenantById(tenantId: string): Promise<Tenant | null>` — in `backend/src/models/tenantModel.ts`, returns `{ userLimit: number, plan: string, ... }`
- `countUsersInTenant(tenantId: string): Promise<number>` — in `backend/src/models/tenantModel.ts`, counts rows WHERE `is_active = TRUE`
- `findUserById(id: string)` — in `backend/src/models/userModel.ts`, returns `{ isActive: boolean, ... }`

- [ ] **Step 1: Add imports for tenant model functions**

At the top of `backend/src/controllers/userController.ts`, add to the existing imports:

```typescript
import { findTenantById, countUsersInTenant } from '../models/tenantModel';
```

The full imports block should look like:

```typescript
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import {
  findAllUsers,
  findSalesUsers,
  findUserById,
  createUser,
  updateUser,
  updateUserPassword,
} from '../models/userModel';
import { findTenantById, countUsersInTenant } from '../models/tenantModel';
```

- [ ] **Step 2: Add the `checkUserLimit` helper function**

Add this function immediately before `createUserHandler` (around line 43):

```typescript
async function checkUserLimit(
  tenantId: string,
  plan: string
): Promise<{ allowed: boolean; currentCount: number; limit: number }> {
  if (plan === 'enterprise') return { allowed: true, currentCount: 0, limit: -1 };
  const tenant = await findTenantById(tenantId);
  if (!tenant) return { allowed: true, currentCount: 0, limit: -1 };
  const currentCount = await countUsersInTenant(tenantId);
  return {
    allowed: currentCount < tenant.userLimit,
    currentCount,
    limit: tenant.userLimit,
  };
}
```

- [ ] **Step 3: Add limit check to `createUserHandler`**

Inside `createUserHandler`, add the check **after** the input validation block and **before** `bcrypt.hash`. The updated function body looks like:

```typescript
export async function createUserHandler(req: Request, res: Response) {
  const { email, username, displayName, password, role } = req.body;
  if (!email || !username || !displayName || !password) {
    res.status(400).json({ error: 'email, username, displayName, password required' });
    return;
  }
  try {
    const check = await checkUserLimit(req.user!.tenantId, req.user!.plan);
    if (!check.allowed) {
      res.status(403).json({
        error: 'USER_LIMIT_REACHED',
        message: `Your ${req.user!.plan} plan allows ${check.limit} users. Contact support to add more licences.`,
        currentCount: check.currentCount,
        limit: check.limit,
        plan: req.user!.plan,
      });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({
      email, username, displayName, passwordHash,
      role:     role || 'sales',
      tenantId: req.user!.tenantId,
    });
    res.status(201).json(user);
  } catch (err: unknown) {
    const pg = err as { code?: string };
    if (pg.code === '23505') { res.status(409).json({ error: 'Email or username already exists' }); return; }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 4: Add limit check to `updateUserHandler`**

Inside `updateUserHandler`, add the check at the top of the `try` block, **only when `isActive === true`**. The full updated function:

```typescript
export async function updateUserHandler(req: Request, res: Response) {
  const { displayName, role, isActive, password } = req.body;
  try {
    // Enforce seat limit when re-activating a currently-inactive user
    if (isActive === true) {
      const existing = await findUserById(req.params.id);
      if (existing && !existing.isActive) {
        const check = await checkUserLimit(req.user!.tenantId, req.user!.plan);
        if (!check.allowed) {
          res.status(403).json({
            error: 'USER_LIMIT_REACHED',
            message: `Your ${req.user!.plan} plan allows ${check.limit} users. Contact support to add more licences.`,
            currentCount: check.currentCount,
            limit: check.limit,
            plan: req.user!.plan,
          });
          return;
        }
      }
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await updateUserPassword(req.params.id, hash);
    }
    const user = await updateUser(req.params.id, { displayName, role, isActive });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles with zero errors**

Run:
```
cmd /c "cd /d "d:\Project\Sale Funnel\backend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner appears, no TypeScript errors.
If errors appear, fix them before proceeding.

---

### Task 2: Frontend — User Limit Reached Dialog

**Files:**
- Modify: `frontend/src/pages/admin/TeamManagement.tsx`

**Context on the existing file:**

```typescript
// Existing imports include:
import { AlertDialog, AlertDialogAction, AlertDialogCancel,
         AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
         AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

// Existing state variables (around line 60):
const [showAddDialog, setShowAddDialog]       = useState(false)
const [showReassignDialog, setShowReassignDialog] = useState(false)
const [showStatusConfirm, setShowStatusConfirm]   = useState(false)

// handleCreateUser (around line 101) — catch block (line 148):
} catch (err: unknown) {
  console.error('Error creating user:', err)
  const msg = (err as Error).message || ''
  if (msg.includes('already exists')) {
    setError('Email or username is already in use')
  } else {
    setError('Failed to create user. Please try again.')
  }
}

// handleToggleStatus (around line 162):
const handleToggleStatus = async () => {
  if (!selectedUser) return
  setIsSubmitting(true)
  try {
    await updateUserStatus(selectedUser.uid, !selectedUser.isActive)
    setShowStatusConfirm(false)
    setSelectedUser(null)
    await fetchData()
  } catch (err) {
    console.error('Error updating user status:', err)
  } finally {
    setIsSubmitting(false)
  }
}
```

**Context on the `usePlan` hook:**
`usePlan()` is already exported from `@/store/authStore`:
```typescript
export const usePlan = () => {
  const user = useAuthStore((state) => state.user)
  return user?.plan ?? null
}
```

- [ ] **Step 1: Import `usePlan` from authStore**

In `TeamManagement.tsx`, the import from `@/store/authStore` does not currently include `usePlan`. Add it:

Find the existing authStore import line. If it looks like:
```typescript
import { useAuthStore } from '@/store/authStore'
```

Change it to:
```typescript
import { useAuthStore, usePlan } from '@/store/authStore'
```

If there is no existing import from `@/store/authStore`, add this line near the top with the other store imports:
```typescript
import { useAuthStore, usePlan } from '@/store/authStore'
```

- [ ] **Step 2: Add `limitReached` state and `plan` variable**

In the component body, immediately after the existing state declarations (after `const [isSubmitting, setIsSubmitting] = useState(false)` around line 73), add:

```typescript
const [limitReached, setLimitReached] = useState(false)
const plan = usePlan()
```

- [ ] **Step 3: Update `handleCreateUser` catch block to detect `USER_LIMIT_REACHED`**

Replace the existing catch block in `handleCreateUser` (currently around line 148):

```typescript
// BEFORE:
} catch (err: unknown) {
  console.error('Error creating user:', err)
  const msg = (err as Error).message || ''
  if (msg.includes('already exists')) {
    setError('Email or username is already in use')
  } else {
    setError('Failed to create user. Please try again.')
  }
}

// AFTER:
} catch (err: unknown) {
  console.error('Error creating user:', err)
  const msg = (err as Error).message || ''
  if (msg === 'USER_LIMIT_REACHED') {
    setShowAddDialog(false)
    setLimitReached(true)
  } else if (msg.includes('already exists')) {
    setError('Email or username is already in use')
  } else {
    setError('Failed to create user. Please try again.')
  }
}
```

- [ ] **Step 4: Update `handleToggleStatus` catch block**

The limit check only matters when **activating** an inactive user (`!selectedUser.isActive`). Replace the existing `handleToggleStatus`:

```typescript
const handleToggleStatus = async () => {
  if (!selectedUser) return
  setIsSubmitting(true)
  try {
    await updateUserStatus(selectedUser.uid, !selectedUser.isActive)
    setShowStatusConfirm(false)
    setSelectedUser(null)
    await fetchData()
  } catch (err: unknown) {
    console.error('Error updating user status:', err)
    const msg = (err as Error).message || ''
    if (msg === 'USER_LIMIT_REACHED' && !selectedUser.isActive) {
      setShowStatusConfirm(false)
      setLimitReached(true)
    }
  } finally {
    setIsSubmitting(false)
  }
}
```

- [ ] **Step 5: Add the User Limit Reached dialog to the JSX**

Find the section in the JSX return where the other `AlertDialog` components are rendered (near the bottom of the return, alongside `showStatusConfirm` and `showReassignDialog` dialogs). Add this new dialog immediately after them:

```tsx
{/* User Limit Reached Dialog */}
<AlertDialog open={limitReached} onOpenChange={setLimitReached}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-yellow-500" />
        User Limit Reached
      </AlertDialogTitle>
      <AlertDialogDescription>
        Your <span className="font-semibold capitalize">{plan ?? 'current'}</span> plan
        has reached its user limit. To add more users, contact DOK support to upgrade
        your plan or purchase an additional licence.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setLimitReached(false)}>Close</AlertDialogCancel>
      <AlertDialogAction
        onClick={() => window.open('mailto:support@dokcrm.com', '_blank')}
      >
        Contact Support
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Note: `AlertTriangle` is already imported in `TeamManagement.tsx` (line 8).

- [ ] **Step 6: Verify TypeScript compiles with zero errors**

Run:
```
cmd /c "cd /d "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit 2>&1"
```

Expected: only the Windows version banner appears, no TypeScript errors.
If errors appear, fix them before proceeding.

- [ ] **Step 7: Manual smoke test**

1. Start the backend: `cd backend && npm run dev`
2. Start the frontend: `cd frontend && npm run dev`
3. Log in as a tenant admin whose tenant is on `starter` plan with `user_limit = 3`
4. Go to Team Management
5. Ensure 3 active users exist
6. Click "Add User" and try to create a new one → the "User Limit Reached" dialog should appear
7. Deactivate one user → now 2 active. Try adding again → should succeed
8. Re-activate the deactivated user → should succeed (2 active → 3)
9. Now try to re-activate again when at 3 → should show the "User Limit Reached" dialog
10. Test with an `enterprise` plan tenant → adding users should never be blocked
