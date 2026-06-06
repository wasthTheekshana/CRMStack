# Lead Reassignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admin users to reassign any lead to any active team member from the lead detail modal and from lead cards on both the Leads list and Pipeline board, with an in-app notification sent to the newly assigned member.

**Architecture:** A dedicated `PATCH /api/leads/:id/owner` endpoint (admin-only) updates `owner_id`/`owner_email` and fires the existing `notifyLeadAssigned`. A shared `ReassignOwnerSelect` React component is mounted in `DealModal`, `KanbanCard`, and `LeadsPage` — visible only to admins.

**Tech Stack:** Express/TypeScript backend, React 18 + shadcn/ui Select + Popover, existing `notifyLeadAssigned`, existing `getAllUsers()` / `getSalesUsers()` from `userService.ts`, existing `useLeads` hook.

---

## File Map

**Modify:**
- `backend/src/controllers/leadController.ts` — add `reassignLeadHandler`
- `backend/src/routes/leads.ts` — add `PATCH /:id/owner` route
- `frontend/src/services/leadService.ts` — add `reassignLead` API function
- `frontend/src/hooks/useLeads.ts` — add `reassignLead` action
- `frontend/src/components/kanban/DealModal.tsx` — add Owner field (admin: dropdown, sales: read-only)
- `frontend/src/components/kanban/KanbanCard.tsx` — add owner chip + popover for admin
- `frontend/src/pages/shared/LeadsPage.tsx` — add owner chip on each lead card

**Create:**
- `frontend/src/components/leads/ReassignOwnerSelect.tsx` — shared reassign dropdown component

---

### Task 1: Backend — `reassignLeadHandler` + Route

**Files:**
- Modify: `backend/src/controllers/leadController.ts`
- Modify: `backend/src/routes/leads.ts`

- [ ] **Step 1: Read the current imports in `leadController.ts`**

Read `backend/src/controllers/leadController.ts` lines 1–17. You'll see `findLeadById` and `updateLead` are already imported from `../models/leadModel`, and `notifyLeadAssigned` is already imported from `../services/notificationService`. You need to add one more import: `findUserById` from `../models/userModel`.

- [ ] **Step 2: Add `findUserById` import to `leadController.ts`**

Find this line:
```typescript
import {
  findAllLeads,
  findDeletedLeads,
  findLeadById,
  getLeadOwnerId,
  createLead,
  updateLead,
  softDeleteLead,
  restoreLead,
} from '../models/leadModel';
```

After it, add:
```typescript
import { findUserById } from '../models/userModel';
```

- [ ] **Step 3: Add `reassignLeadHandler` at the end of `leadController.ts`**

Append this function after `restoreLeadHandler`:

```typescript
export async function reassignLeadHandler(req: Request, res: Response) {
  const { id } = req.params;
  const { ownerId } = req.body;

  if (!ownerId) {
    res.status(400).json({ error: 'ownerId is required' }); return;
  }

  try {
    const existing = await findLeadById(id, req.user!.tenantId);
    if (!existing) {
      res.status(404).json({ error: 'Lead not found' }); return;
    }

    if (existing.ownerId === ownerId) {
      res.json(existing); return;
    }

    const newOwner = await findUserById(ownerId);
    if (!newOwner || newOwner.tenantId !== req.user!.tenantId || !newOwner.isActive) {
      res.status(400).json({ error: 'Invalid owner: user not found or not in this tenant' }); return;
    }

    const updated = await updateLead(id, req.user!.tenantId, {
      ownerId:    newOwner.id    as string,
      ownerEmail: newOwner.email as string,
    });
    if (!updated) {
      res.status(404).json({ error: 'Lead not found' }); return;
    }

    notifyLeadAssigned({
      tenantId:    req.user!.tenantId,
      assigneeId:  newOwner.id  as string,
      actorId:     req.user!.userId,
      companyName: existing.companyName as string,
    });

    res.json(updated);
  } catch (err) {
    console.error('reassignLeadHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 4: Add the route in `leads.ts`**

Read `backend/src/routes/leads.ts`. Find the import line that lists controller functions and add `reassignLeadHandler`:

```typescript
import {
  listLeads,
  listDeletedLeads,
  getLead,
  createLeadHandler,
  updateLeadHandler,
  deleteLeadHandler,
  restoreLeadHandler,
  reassignLeadHandler,
} from '../controllers/leadController';
```

Then add the route after the restore route:

```typescript
router.patch('/:id/owner',   requireAuth, requireAdmin, reassignLeadHandler);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "d:\Project\Sale Funnel\backend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/leadController.ts backend/src/routes/leads.ts
git commit -m "feat(leads): add PATCH /:id/owner endpoint for admin lead reassignment"
```

---

### Task 2: Frontend — API Function + `useLeads` Action

**Files:**
- Modify: `frontend/src/services/leadService.ts`
- Modify: `frontend/src/hooks/useLeads.ts`

- [ ] **Step 1: Add `reassignLead` to `leadService.ts`**

Read `frontend/src/services/leadService.ts`. After the `updateLead` export (line 19–23), add:

```typescript
export const reassignLead = (leadId: string, ownerId: string) =>
  apiFetch<Lead>(`/api/leads/${leadId}/owner`, {
    method: 'PATCH',
    body: JSON.stringify({ ownerId }),
  });
```

- [ ] **Step 2: Add `reassignLead` to `useLeads.ts`**

Read `frontend/src/hooks/useLeads.ts`. 

First, add `reassignLead as reassignLeadFn` to the import from `'@/lib/api/collections'`. The current import looks like:

```typescript
import {
  getLeads,
  createLead as createLeadFn,
  updateLead as updateLeadFn,
  deleteLead as deleteLeadFn,
} from '@/lib/api/collections'
```

Change it to:

```typescript
import {
  getLeads,
  createLead as createLeadFn,
  updateLead as updateLeadFn,
  deleteLead as deleteLeadFn,
  reassignLead as reassignLeadFn,
} from '@/lib/api/collections'
```

- [ ] **Step 3: Check `collections.ts` re-exports `leadService`**

Read `frontend/src/lib/api/collections.ts`. It re-exports from services. Confirm it re-exports from `leadService`. If it does not have a catch-all re-export for `leadService`, add:

```typescript
export * from '../../services/leadService'
```

- [ ] **Step 4: Add `reassignLead` callback in `useLeads`**

In `frontend/src/hooks/useLeads.ts`, add this callback after `updateLead`:

```typescript
  const reassignLead = useCallback(async (leadId: string, ownerId: string) => {
    const updated = await reassignLeadFn(leadId, ownerId)
    setLeads(prev => prev.map(l => l.id === leadId ? updated : l))
    return updated
  }, [])
```

And add `reassignLead` to the return object:

```typescript
  return {
    leads,
    leadsByStage,
    isLoading,
    error,
    createLead,
    updateLead,
    deleteLead,
    updateLeadStage,
    updateLeadPosition,
    reassignLead,
    refetch: fetchLeads,
  }
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/leadService.ts frontend/src/hooks/useLeads.ts frontend/src/lib/api/collections.ts
git commit -m "feat(leads): add reassignLead API function and useLeads action"
```

---

### Task 3: Frontend — `ReassignOwnerSelect` Shared Component

**Files:**
- Create: `frontend/src/components/leads/ReassignOwnerSelect.tsx`

This component renders a shadcn `<Select>` pre-populated with all active users. When the admin picks a different user, it calls `PATCH /api/leads/:id/owner` and notifies the parent via `onReassigned()`.

- [ ] **Step 1: Check what `getAllUsers` returns**

Read `frontend/src/services/userService.ts` lines 7–8. `getAllUsers` returns `User[]` from `/api/users`. The `User` type has `id` (or `uid`), `displayName`, `email`, `role`, `isActive`.

Also check the `User` type in `frontend/src/models/index.ts` or `frontend/src/types/index.ts` to confirm the shape — specifically whether the id field is `id` or `uid`.

- [ ] **Step 2: Create `ReassignOwnerSelect.tsx`**

Create `frontend/src/components/leads/ReassignOwnerSelect.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { reassignLead } from '@/services/leadService'
import { getAllUsers } from '@/services/userService'
import { toast } from 'sonner'

interface TeamMember {
  id: string
  displayName: string
  email: string
  role: string
  isActive: boolean
}

interface Props {
  leadId:         string
  currentOwnerId: string
  onReassigned:   (updated: { id: string; ownerId: string; ownerEmail: string }) => void
}

export function ReassignOwnerSelect({ leadId, currentOwnerId, onReassigned }: Props) {
  const [members, setMembers]   = useState<TeamMember[]>([])
  const [loading, setLoading]   = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    getAllUsers()
      .then((users) => {
        // Keep only active users, map to TeamMember shape
        const active = users
          .filter((u) => u.isActive !== false)
          .map((u) => ({
            id:          (u.uid || u.id) as string,
            displayName: u.displayName as string,
            email:       u.email       as string,
            role:        u.role        as string,
            isActive:    u.isActive    as boolean,
          }))
        setMembers(active)
      })
      .catch(() => toast.error('Failed to load team members'))
      .finally(() => setFetching(false))
  }, [])

  const handleChange = async (newOwnerId: string) => {
    if (newOwnerId === currentOwnerId) return
    setLoading(true)
    try {
      const updated = await reassignLead(leadId, newOwnerId)
      onReassigned({
        id:         updated.id         as string,
        ownerId:    updated.ownerId    as string,
        ownerEmail: updated.ownerEmail as string,
      })
      toast.success('Lead reassigned')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reassign lead'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
  }

  return (
    <div className="relative">
      {loading && (
        <Loader2 className="absolute right-8 top-2.5 h-4 w-4 animate-spin text-muted-foreground z-10" />
      )}
      <Select
        value={currentOwnerId}
        onValueChange={handleChange}
        disabled={loading}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select owner" />
        </SelectTrigger>
        <SelectContent>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.displayName} ({m.role})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit
```

Expected: no errors. If you get errors about `u.uid` vs `u.id`, read `frontend/src/models/index.ts` to find the correct field name and adjust line `id: (u.uid || u.id) as string` accordingly.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/leads/ReassignOwnerSelect.tsx
git commit -m "feat(leads): add ReassignOwnerSelect shared component"
```

---

### Task 4: Frontend — Wire into `DealModal`

**Files:**
- Modify: `frontend/src/components/kanban/DealModal.tsx`

Add an "Owner" row in the form. Admins see `ReassignOwnerSelect`; sales users see the owner email as plain text.

- [ ] **Step 1: Read `DealModal.tsx` to understand current structure**

Read `frontend/src/components/kanban/DealModal.tsx` in full (525 lines). The form is inside `<form onSubmit={handleSubmit(onSubmit)}>`. The fields are in a grid. The footer starts at line 483.

- [ ] **Step 2: Add imports to `DealModal.tsx`**

Add these two imports after the existing imports:

```typescript
import { ReassignOwnerSelect } from '@/components/leads/ReassignOwnerSelect'
import { useIsAdmin } from '@/store/authStore'
```

- [ ] **Step 3: Add `isAdmin` and owner state in the component**

Inside `DealModal`, after the existing state declarations (around line 68–71), add:

```typescript
  const isAdmin = useIsAdmin()
  const [currentOwnerId, setCurrentOwnerId] = useState(lead?.ownerId ?? '')
```

Also add a `useEffect` to sync `currentOwnerId` when `lead` changes (add after the existing `useEffect` that syncs contacts):

```typescript
  useEffect(() => {
    if (lead) setCurrentOwnerId(lead.ownerId)
  }, [lead])
```

- [ ] **Step 4: Add the Owner field in the form**

In the form, find the `<div className="grid grid-cols-2 gap-4">` block that starts after the Contacts section (around line 379). Add an Owner row **before** the Sales Stage row:

```tsx
          <div className="space-y-2 col-span-2">
            <Label>Owner</Label>
            {isAdmin ? (
              lead && (
                <ReassignOwnerSelect
                  leadId={lead.id}
                  currentOwnerId={currentOwnerId}
                  onReassigned={({ ownerId, ownerEmail }) => {
                    setCurrentOwnerId(ownerId)
                    // keep the parent's lead list in sync
                    onSave(lead.id, { ownerId, ownerEmail })
                      .catch(() => {/* already toasted by ReassignOwnerSelect */})
                  }}
                />
              )
            ) : (
              <p className="text-sm text-muted-foreground">{lead?.ownerEmail}</p>
            )}
          </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/kanban/DealModal.tsx
git commit -m "feat(leads): add Owner reassign field to DealModal (admin only)"
```

---

### Task 5: Frontend — Wire into `KanbanCard` (Pipeline Board)

**Files:**
- Modify: `frontend/src/components/kanban/KanbanCard.tsx`

Add an owner chip at the bottom of each card. For admins it opens a `Popover` with `ReassignOwnerSelect`; for sales users it is plain text.

- [ ] **Step 1: Add imports to `KanbanCard.tsx`**

Read `frontend/src/components/kanban/KanbanCard.tsx`. The current imports are on lines 1–9.

Add these imports:

```typescript
import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ReassignOwnerSelect } from '@/components/leads/ReassignOwnerSelect'
import { useIsAdmin } from '@/store/authStore'
```

- [ ] **Step 2: Update `KanbanCardProps` to pass `onReassigned`**

Find the `KanbanCardProps` interface (lines 11–14):

```typescript
interface KanbanCardProps {
  lead: Lead
  onClick: () => void
}
```

Replace with:

```typescript
interface KanbanCardProps {
  lead:          Lead
  onClick:       () => void
  onReassigned?: (update: { id: string; ownerId: string; ownerEmail: string }) => void
}
```

- [ ] **Step 3: Update the `KanbanCard` function signature**

Find:
```typescript
export function KanbanCard({ lead, onClick }: KanbanCardProps) {
```

Replace with:
```typescript
export function KanbanCard({ lead, onClick, onReassigned }: KanbanCardProps) {
```

- [ ] **Step 4: Add state and hook inside `KanbanCard`**

After the `useSortable` block (around line 25), add:

```typescript
  const isAdmin = useIsAdmin()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [ownerId, setOwnerId] = useState(lead.ownerId)
  const [ownerEmail, setOwnerEmail] = useState(lead.ownerEmail)
```

- [ ] **Step 5: Add owner chip at bottom of card**

Find the closing `</div>` of the inner flex layout (the one that contains revenue and probability bar, around line 97). After that closing `</div>` and before the outer `</div>` that closes `flex-1 min-w-0`, add:

```tsx
            {isAdmin ? (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="mt-1.5 text-[10px] text-muted-foreground hover:text-foreground truncate max-w-full text-left"
                    onClick={(e) => { e.stopPropagation(); setPopoverOpen(true) }}
                  >
                    {ownerEmail}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs text-muted-foreground mb-2">Reassign lead</p>
                  <ReassignOwnerSelect
                    leadId={lead.id}
                    currentOwnerId={ownerId}
                    onReassigned={(update) => {
                      setOwnerId(update.ownerId)
                      setOwnerEmail(update.ownerEmail)
                      setPopoverOpen(false)
                      onReassigned?.(update)
                    }}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <p className="mt-1.5 text-[10px] text-muted-foreground truncate">{ownerEmail}</p>
            )}
```

- [ ] **Step 6: Find where `KanbanCard` is used and pass `onReassigned`**

Search for `<KanbanCard` in the codebase:

```bash
grep -r "KanbanCard" "d:\Project\Sale Funnel\frontend\src" --include="*.tsx" -l
```

Read the file(s) that render `KanbanCard` (likely `PipelinePage.tsx` or a board component). Add `onReassigned` prop:

```tsx
<KanbanCard
  lead={lead}
  onClick={...}
  onReassigned={(update) => {
    // update local lead state so the card reflects the new owner immediately
    // if the parent has a way to update a single lead, call it here
    // otherwise refetch will sync on next poll
  }}
/>
```

If the parent has access to `useLeads`'s `reassignLead` or `refetch`, use those. If not, a no-op is fine — the 30s poll will sync.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/kanban/KanbanCard.tsx
git commit -m "feat(leads): add owner chip + reassign popover to KanbanCard (admin only)"
```

---

### Task 6: Frontend — Wire into `LeadsPage`

**Files:**
- Modify: `frontend/src/pages/shared/LeadsPage.tsx`

Add an owner chip on each lead card in the grid. Admins see an inline `ReassignOwnerSelect`; sales users see the owner email as plain text.

- [ ] **Step 1: Read the lead card JSX in `LeadsPage.tsx`**

Read `frontend/src/pages/shared/LeadsPage.tsx` lines 80–200 to find where each lead card is rendered. Look for the card that shows `lead.companyName`, `lead.solution`, and the stage badge.

- [ ] **Step 2: Add imports to `LeadsPage.tsx`**

Find the existing import block. Add:

```typescript
import { ReassignOwnerSelect } from '@/components/leads/ReassignOwnerSelect'
```

`useIsAdmin` is already imported on line 25. `reassignLead` action is already available via `useLeads` after Task 2.

- [ ] **Step 3: Destructure `reassignLead` from `useLeads`**

Find line 41:
```typescript
  const { leads, isLoading, createLead, updateLead, deleteLead, refetch } = useLeads()
```

Add `reassignLead`:
```typescript
  const { leads, isLoading, createLead, updateLead, deleteLead, reassignLead, refetch } = useLeads()
```

- [ ] **Step 4: Add owner row to each lead card**

Inside the lead card JSX (find where each card renders lead info), add an owner row near the bottom of the card. Look for a `<div>` that contains the stage badge or revenue — add after the last info row:

```tsx
              <div className="mt-2 pt-2 border-t">
                {isAdmin ? (
                  <ReassignOwnerSelect
                    leadId={lead.id}
                    currentOwnerId={lead.ownerId}
                    onReassigned={({ ownerId, ownerEmail }) => {
                      reassignLead(lead.id, ownerId).catch(() => {})
                    }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground truncate">{lead.ownerEmail}</p>
                )}
              </div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "d:\Project\Sale Funnel\frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/shared/LeadsPage.tsx
git commit -m "feat(leads): add owner reassign to lead cards in LeadsPage (admin only)"
```
