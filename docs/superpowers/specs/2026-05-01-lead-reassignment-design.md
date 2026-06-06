# Lead Reassignment Design

**Goal:** Allow admin users to reassign any lead to any active team member from two places — the lead detail modal and the lead cards on both the Leads list and Pipeline board. The newly assigned member receives an in-app notification.

**Architecture:** A dedicated `PATCH /api/leads/:id/owner` endpoint (admin-only) updates the lead's `owner_id` and `owner_email`, then fires the existing `notifyLeadAssigned` from `notificationService`. On the frontend, a shared `ReassignOwnerSelect` component is wired into `DealModal`, `KanbanCard`, and `LeadsPage`.

**Tech Stack:** Express/TypeScript backend, React 18 + shadcn/ui frontend, existing `notifyLeadAssigned` notification service, existing `getSalesUsers` API call.

---

## What Already Exists (do not rewrite)

- `notifyLeadAssigned` in `backend/src/services/notificationService.ts` — already skips notification if assignee === actor
- `updateLead(id, data)` in `backend/src/models/leadModel.ts` — already accepts optional `ownerId` and `ownerEmail`
- `getSalesUsers()` in `frontend/src/services/userService.ts` — fetches active sales users from `/api/users/sales`
- `useLeads` hook in `frontend/src/hooks/useLeads.ts` — has `refetch()` and `updateLead(id, data)`
- In-app notification panel — already renders `lead_assigned` notifications

---

## Backend

### New Route

**File:** `backend/src/routes/leads.ts`

Add below the existing routes:
```typescript
router.patch('/:id/owner', requireAuth, requireAdmin, reassignLeadHandler);
```

### New Handler — `reassignLeadHandler`

**File:** `backend/src/controllers/leadController.ts`

```typescript
export async function reassignLeadHandler(req: Request, res: Response) {
  const { id } = req.params;
  const { ownerId } = req.body;
  const actor = (req as AuthRequest).user;

  if (!ownerId) {
    res.status(400).json({ error: 'ownerId is required' }); return;
  }

  try {
    // Verify lead exists in this tenant
    const existing = await getLeadById(id, actor.tenantId);
    if (!existing) {
      res.status(404).json({ error: 'Lead not found' }); return;
    }

    // No-op if already assigned to this owner
    if (existing.ownerId === ownerId) {
      res.json(existing); return;
    }

    // Verify new owner is an active user in this tenant
    const newOwner = await findUserById(ownerId);
    if (!newOwner || newOwner.tenantId !== actor.tenantId || !newOwner.isActive) {
      res.status(400).json({ error: 'Invalid owner: user not found or not in this tenant' }); return;
    }

    // Update lead ownership
    const updated = await updateLead(id, {
      ownerId:    newOwner.id as string,
      ownerEmail: newOwner.email as string,
    }, actor.tenantId);

    // Notify new owner
    notifyLeadAssigned({
      tenantId:    actor.tenantId,
      assigneeId:  newOwner.id as string,
      actorId:     actor.userId,
      companyName: existing.companyName,
    });

    res.json(updated);
  } catch (err) {
    console.error('reassignLeadHandler error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Imports to add in `leadController.ts`:**
- `notifyLeadAssigned` from `../services/notificationService`
- `findUserById` from `../models/userModel`
- `getLeadById` — verify this exists in `leadModel.ts`; if not, use the existing `getLead` query pattern

---

## Frontend

### New Shared Component — `ReassignOwnerSelect`

**File:** `frontend/src/components/leads/ReassignOwnerSelect.tsx`

Props:
```typescript
interface Props {
  leadId:         string;
  currentOwnerId: string;
  onReassigned:   () => void;   // triggers refetch in parent
}
```

Behaviour:
- On mount, fetches active users via `getAllUsers()` (from `userService`) — includes all roles so admin can assign to any team member
- Renders a shadcn `<Select>` showing the current owner pre-selected
- On value change: calls `PATCH /api/leads/:id/owner` via a new `reassignLead(leadId, ownerId)` function in `leadsApi.ts`, then calls `onReassigned()`
- Shows a loading spinner on the select while the request is in-flight
- On error: `toast.error('Failed to reassign lead')`
- Only rendered when the current user `isAdmin` (checked via `useIsAdmin()`)

### New API Function

**File:** `frontend/src/lib/api/leadsApi.ts` (create if not exists, else add to existing leads API file)

```typescript
export const reassignLead = (leadId: string, ownerId: string) =>
  apiFetch<Lead>(`/api/leads/${leadId}/owner`, {
    method: 'PATCH',
    body: JSON.stringify({ ownerId }),
  });
```

### `DealModal.tsx` — Modify

**File:** `frontend/src/components/kanban/DealModal.tsx`

In the lead detail view, add an "Owner" row in the info section:
- Admin: renders `<ReassignOwnerSelect leadId={lead.id} currentOwnerId={lead.ownerId} onReassigned={onClose} />`  
  (closing the modal after reassign is acceptable; alternatively call a passed-in `refetch`)
- Sales user: renders `<span>{lead.ownerEmail}</span>` (read-only, as today)

### `KanbanCard.tsx` — Modify

**File:** `frontend/src/components/kanban/KanbanCard.tsx`

Add a small owner chip at the bottom of each card showing the owner's email/name.
- Admin: chip is a trigger for a shadcn `<Popover>` containing `<ReassignOwnerSelect>`. The popover closes after reassign via `onReassigned`.
- Sales user: chip is plain text, non-interactive.

### `LeadsPage.tsx` — Modify

**File:** `frontend/src/pages/shared/LeadsPage.tsx`

In the lead card (grid view) or row (table view), add an owner field:
- Admin: renders `<ReassignOwnerSelect>` inline (same pattern as KanbanCard).
- Sales user: reads owner email as plain text.

---

## Data Flow

```
Admin clicks new owner in ReassignOwnerSelect
  → PATCH /api/leads/:id/owner { ownerId }
    → verify lead in tenant
    → verify new owner active + in tenant
    → UPDATE leads SET owner_id, owner_email
    → notifyLeadAssigned (fire-and-forget)
  → response: updated Lead
→ onReassigned() → refetch() in useLeads
→ new owner sees notification in bell panel on next poll (30s) or page refresh
```

---

## Security

- `requireAdmin` middleware on the route — sales users cannot call this endpoint
- Backend verifies `newOwner.tenantId === actor.tenantId` — cannot reassign to a user from another tenant
- Frontend hides `ReassignOwnerSelect` for non-admin users via `useIsAdmin()`

---

## Error States

| Scenario | Handling |
|---|---|
| `ownerId` missing in request | 400 |
| Lead not found / wrong tenant | 404 |
| New owner not found / inactive / wrong tenant | 400 |
| Same owner as current | No-op — return existing lead, no notification |
| DB error | 500 → `toast.error` on frontend |
