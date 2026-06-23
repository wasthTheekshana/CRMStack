# Group 2: Bulk Actions + Lead Filtering & Saved Views

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two features: (1) multi-select checkboxes on lead cards with a bulk action toolbar (reassign/stage/delete), and (2) saved filter views that persist across page reloads.

**Architecture:**
- Bulk actions: two new backend endpoints (`PATCH /api/leads/bulk` and `DELETE /api/leads/bulk`) + checkbox selection state + floating toolbar in `LeadsPage.tsx`.
- Saved views: one new DB migration (`019_saved_views.sql`), backend CRUD (`/api/saved-views`), minimal UI in `LeadsPage.tsx` — a "Save view" button that names the current filters and a dropdown to reload them.

**Tech Stack:** Express + PostgreSQL (backend), React 18 + TypeScript + Vite (frontend), existing `apiFetch` / `query` patterns.

---

## File Map

**Feature 5 — Bulk Actions**
- Modify: `backend/src/controllers/leadController.ts` — add `bulkUpdateLeads`, `bulkDeleteLeads`
- Modify: `backend/src/routes/leads.ts` — register bulk routes
- Modify: `frontend/src/hooks/useLeads.ts` — add `bulkUpdate`, `bulkDelete` helpers
- Modify: `frontend/src/pages/shared/LeadsPage.tsx` — add selection state + bulk toolbar

**Feature 6 — Saved Views**
- Create: `backend/migrations/019_saved_views.sql`
- Create: `backend/src/models/savedViewModel.ts`
- Create: `backend/src/controllers/savedViewController.ts`
- Create: `backend/src/routes/savedViews.ts`
- Modify: `backend/src/routes/index.ts` — register saved views route
- Create: `frontend/src/services/savedViewService.ts`
- Modify: `frontend/src/pages/shared/LeadsPage.tsx` — add save/load view UI

---

## Task 1: Bulk Actions — Backend

**Files:**
- Modify: `backend/src/controllers/leadController.ts`
- Modify: `backend/src/routes/leads.ts`

- [ ] **Step 1: Add `bulkUpdateLeads` controller**

Open `backend/src/controllers/leadController.ts` and add at the end:

```typescript
export async function bulkUpdateLeads(req: Request, res: Response) {
  const { ids, update } = req.body as {
    ids:    string[]
    update: { salesStage?: string; ownerId?: string; ownerEmail?: string }
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids array required' })
    return
  }

  const ALLOWED_FIELDS = ['salesStage', 'ownerId', 'ownerEmail']
  const keys = Object.keys(update ?? {})
  if (keys.length === 0 || keys.some(k => !ALLOWED_FIELDS.includes(k))) {
    res.status(400).json({ error: 'update must contain only: salesStage, ownerId, ownerEmail' })
    return
  }

  try {
    const { tenantId, userId, role } = req.user!
    // Admins can bulk-update any lead; regular users can only update their own
    const results: { id: string; ok: boolean }[] = []
    for (const id of ids) {
      const lead = await getLeadOwnerId(id, tenantId)
      if (!lead) { results.push({ id, ok: false }); continue }
      if (role !== 'admin' && lead !== userId) { results.push({ id, ok: false }); continue }
      await updateLead(id, tenantId, update)
      results.push({ id, ok: true })
    }
    res.json({ results, updated: results.filter(r => r.ok).length })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function bulkDeleteLeads(req: Request, res: Response) {
  const { ids } = req.body as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids array required' })
    return
  }

  try {
    const { tenantId } = req.user!
    let deleted = 0
    for (const id of ids) {
      await softDeleteLead(id, tenantId)
      deleted++
    }
    res.json({ deleted })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

> **Check imports:** The controller already imports `updateLead`, `softDeleteLead` from the lead model. Also import `getLeadOwnerId` if not already imported — check the top of `leadController.ts` and add it to the model import line if needed.

- [ ] **Step 2: Register the routes**

Open `backend/src/routes/leads.ts` and add the two bulk routes **before** the `:id` routes (to avoid route conflicts):

```typescript
import { ..., bulkUpdateLeads, bulkDeleteLeads } from '../controllers/leadController'
```

Add routes (place BEFORE `router.get('/:id', ...)`):
```typescript
router.patch('/bulk',  requireAuth, bulkUpdateLeads)
router.delete('/bulk', requireAuth, requireAdmin, bulkDeleteLeads)
```

> **Note:** Bulk delete is admin-only. Bulk update (reassign/stage) is open to any authenticated user but controller restricts to own leads for non-admins.

- [ ] **Step 3: Verify backend compiles**

```bash
cd "d:/Project/Sale Funnel/backend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test with curl**

Start backend if not running. Create a test lead ID from DB, then:

```bash
# Bulk stage update (use real lead IDs)
curl -X PATCH http://localhost:4000/api/leads/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"ids":["<lead-id>"],"update":{"salesStage":"Proposal Sent"}}'
```

Expected: `{"results":[{"id":"...","ok":true}],"updated":1}`

- [ ] **Step 5: Commit**

```bash
cd "d:/Project/Sale Funnel"
git add backend/src/controllers/leadController.ts backend/src/routes/leads.ts
git commit -m "feat(leads): add bulk update and bulk delete backend endpoints"
```

---

## Task 2: Bulk Actions — Frontend

**Files:**
- Modify: `frontend/src/hooks/useLeads.ts`
- Modify: `frontend/src/pages/shared/LeadsPage.tsx`

- [ ] **Step 1: Add bulk helpers to useLeads.ts**

Open `frontend/src/hooks/useLeads.ts`. Add two new exported async functions inside the hook (alongside `reassignLead`, `deleteLead`, etc.):

```typescript
const bulkUpdate = useCallback(async (
  ids: string[],
  update: { salesStage?: string; ownerId?: string; ownerEmail?: string }
) => {
  await apiFetch('/api/leads/bulk', {
    method: 'PATCH',
    body: JSON.stringify({ ids, update }),
  })
  // Optimistic: update local state
  setLeads(prev => prev.map(l =>
    ids.includes(l.id)
      ? { ...l, ...update }
      : l
  ))
}, [])

const bulkDelete = useCallback(async (ids: string[]) => {
  await apiFetch('/api/leads/bulk', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  })
  setLeads(prev => prev.filter(l => !ids.includes(l.id)))
}, [])
```

Also add `bulkUpdate` and `bulkDelete` to the hook's return object.

> **Check:** `apiFetch` import — verify it's imported from `@/services/apiClient` or similar, the same as other fetch calls in the file. `setLeads` is the existing internal state setter — confirm the variable name by checking the top of `useLeads.ts`.

- [ ] **Step 2: Add selection state and bulk toolbar to LeadsPage.tsx**

Open `frontend/src/pages/shared/LeadsPage.tsx`.

**2a. Import new icons + components at the top:**
```typescript
import { Trash2, UserCheck, Tags } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
```

**2b. Get `bulkUpdate` and `bulkDelete` from the hook:**
```typescript
const { leads, isLoading, error, createLead, bulkUpdate, bulkDelete, refetch } = useLeads()
```
(Add `bulkUpdate`, `bulkDelete` to the existing destructure)

**2c. Add selection state** (after the existing filter state declarations):
```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

const toggleSelect = (id: string) =>
  setSelectedIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

const toggleSelectAll = () =>
  setSelectedIds(prev =>
    prev.size === filteredLeads.length
      ? new Set()
      : new Set(filteredLeads.map(l => l.id))
  )

const clearSelection = () => setSelectedIds(new Set())
```

**2d. Add stage/owner change handlers:**
```typescript
const handleBulkStageChange = async (newStage: string) => {
  try {
    await bulkUpdate(Array.from(selectedIds), { salesStage: newStage })
    toast.success(`${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} moved to ${newStage}`)
    clearSelection()
  } catch {
    toast.error('Bulk stage update failed')
  }
}

const handleBulkDelete = async () => {
  if (!confirm(`Delete ${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return
  try {
    await bulkDelete(Array.from(selectedIds))
    toast.success(`${selectedIds.size} lead${selectedIds.size !== 1 ? 's' : ''} deleted`)
    clearSelection()
  } catch {
    toast.error('Bulk delete failed')
  }
}
```

**2e. Add bulk action toolbar** — insert this block just before the leads grid (before the `<div className="grid ...">` that maps lead cards):

```tsx
{/* Bulk action toolbar — shown when items are selected */}
{selectedIds.size > 0 && (
  <div className="sticky top-16 z-30 flex items-center gap-3 bg-background border rounded-lg px-4 py-2.5 shadow-md mb-3">
    <span className="text-sm font-medium">{selectedIds.size} selected</span>
    <div className="flex-1" />

    {/* Bulk stage change */}
    <Select onValueChange={handleBulkStageChange}>
      <SelectTrigger className="h-8 w-40 text-xs">
        <Tags className="h-3.5 w-3.5 mr-1.5" />
        <SelectValue placeholder="Change stage" />
      </SelectTrigger>
      <SelectContent>
        {salesStages.map(s => (
          <SelectItem key={s.id} value={s.name} className="text-xs">{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    {/* Bulk delete — admin only */}
    {isAdmin && (
      <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="h-8 text-xs">
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        Delete
      </Button>
    )}

    <Button size="sm" variant="ghost" onClick={clearSelection} className="h-8 text-xs">
      Clear
    </Button>
  </div>
)}
```

**2f. Add "select all" checkbox** — find the area where the lead count / filter summary is shown (likely near `filteredLeads.length`). Add a select-all checkbox nearby:

```tsx
{filteredLeads.length > 0 && (
  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
    <Checkbox
      checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
      onCheckedChange={toggleSelectAll}
    />
    {selectedIds.size > 0 ? `${selectedIds.size} of ${filteredLeads.length}` : `${filteredLeads.length} leads`}
  </label>
)}
```

**2g. Add per-card checkbox** — inside the lead card map, add a checkbox in the top-left corner of each card. The lead cards are rendered inside the grid div. Find the card element (likely a `<div>` or `<Card>`) and add:

```tsx
<div className="relative">
  <div className="absolute top-2 left-2 z-10">
    <Checkbox
      checked={selectedIds.has(lead.id)}
      onCheckedChange={() => toggleSelect(lead.id)}
      onClick={e => e.stopPropagation()}
    />
  </div>
  {/* existing card content */}
</div>
```

Wrap the card content in a `relative` container and add the checkbox overlay as shown. Make sure `onClick` on the checkbox stops propagation so it doesn't open the DealModal.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "d:/Project/Sale Funnel/frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "d:/Project/Sale Funnel"
git add frontend/src/hooks/useLeads.ts frontend/src/pages/shared/LeadsPage.tsx
git commit -m "feat(leads): add multi-select bulk actions to leads page"
```

---

## Task 3: Saved Views — Backend

**Files:**
- Create: `backend/migrations/019_saved_views.sql`
- Create: `backend/src/models/savedViewModel.ts`
- Create: `backend/src/controllers/savedViewController.ts`
- Create: `backend/src/routes/savedViews.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create migration**

```sql
-- backend/migrations/019_saved_views.sql
CREATE TABLE IF NOT EXISTS saved_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  filters    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_tenant_user ON saved_views(tenant_id, user_id);
```

Run:
```bash
cd "d:/Project/Sale Funnel/backend" && npm run migrate
```

Expected: `✅ 019_saved_views.sql`

- [ ] **Step 2: Create savedViewModel.ts**

```typescript
// backend/src/models/savedViewModel.ts
import { query } from '../config/db'

export interface SavedView {
  id:        string
  tenantId:  string
  userId:    string
  name:      string
  filters:   Record<string, unknown>
  createdAt: string
}

const mapRow = (r: Record<string, unknown>): SavedView => ({
  id:        r.id        as string,
  tenantId:  r.tenant_id as string,
  userId:    r.user_id   as string,
  name:      r.name      as string,
  filters:   (r.filters  as Record<string, unknown>) ?? {},
  createdAt: r.created_at as string,
})

export async function findSavedViews(tenantId: string, userId: string): Promise<SavedView[]> {
  const result = await query(
    `SELECT * FROM saved_views
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY created_at ASC`,
    [tenantId, userId]
  )
  return result.rows.map(mapRow)
}

export async function createSavedView(data: {
  tenantId: string
  userId:   string
  name:     string
  filters:  Record<string, unknown>
}): Promise<SavedView> {
  const result = await query(
    `INSERT INTO saved_views (tenant_id, user_id, name, filters)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.tenantId, data.userId, data.name, JSON.stringify(data.filters)]
  )
  return mapRow(result.rows[0])
}

export async function deleteSavedView(id: string, userId: string, tenantId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM saved_views WHERE id = $1 AND user_id = $2 AND tenant_id = $3',
    [id, userId, tenantId]
  )
  return (result.rowCount ?? 0) > 0
}
```

- [ ] **Step 3: Create savedViewController.ts**

```typescript
// backend/src/controllers/savedViewController.ts
import { Request, Response } from 'express'
import { findSavedViews, createSavedView, deleteSavedView } from '../models/savedViewModel'

export async function listSavedViews(req: Request, res: Response) {
  try {
    const views = await findSavedViews(req.user!.tenantId, req.user!.userId)
    res.json(views)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function createSavedViewHandler(req: Request, res: Response) {
  const { name, filters } = req.body
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }
  if (!filters || typeof filters !== 'object') {
    res.status(400).json({ error: 'filters object required' })
    return
  }
  try {
    const view = await createSavedView({
      tenantId: req.user!.tenantId,
      userId:   req.user!.userId,
      name:     name.trim(),
      filters,
    })
    res.status(201).json(view)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}

export async function deleteSavedViewHandler(req: Request, res: Response) {
  try {
    const deleted = await deleteSavedView(req.params.id, req.user!.userId, req.user!.tenantId)
    if (!deleted) { res.status(404).json({ error: 'Not found' }); return }
    res.json({ success: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

- [ ] **Step 4: Create savedViews.ts route**

```typescript
// backend/src/routes/savedViews.ts
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listSavedViews, createSavedViewHandler, deleteSavedViewHandler } from '../controllers/savedViewController'

const router = Router()

router.get('/',      requireAuth, listSavedViews)
router.post('/',     requireAuth, createSavedViewHandler)
router.delete('/:id', requireAuth, deleteSavedViewHandler)

export default router
```

- [ ] **Step 5: Register in index.ts**

Open `backend/src/routes/index.ts`. Add:
```typescript
import savedViewRoutes from './savedViews';
```
```typescript
router.use('/saved-views', savedViewRoutes);
```

- [ ] **Step 6: Verify backend compiles**

```bash
cd "d:/Project/Sale Funnel/backend" && npx tsc --noEmit
```

- [ ] **Step 7: Test with curl**

```bash
# List saved views (should be empty initially)
curl http://localhost:4000/api/saved-views \
  -H "Authorization: Bearer <token>"

# Create a saved view
curl -X POST http://localhost:4000/api/saved-views \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"My High-Value Leads","filters":{"salesStage":"Proposal Sent","minRevenue":100000}}'
```

Expected: `201` with `{ id, name, filters, createdAt }`

- [ ] **Step 8: Commit**

```bash
cd "d:/Project/Sale Funnel"
git add backend/migrations/019_saved_views.sql \
        backend/src/models/savedViewModel.ts \
        backend/src/controllers/savedViewController.ts \
        backend/src/routes/savedViews.ts \
        backend/src/routes/index.ts
git commit -m "feat(saved-views): add saved views backend (migration + model + controller + routes)"
```

---

## Task 4: Saved Views — Frontend

**Files:**
- Create: `frontend/src/services/savedViewService.ts`
- Modify: `frontend/src/pages/shared/LeadsPage.tsx`

- [ ] **Step 1: Create savedViewService.ts**

```typescript
// frontend/src/services/savedViewService.ts
import { apiFetch } from './apiClient'

export interface SavedView {
  id:        string
  name:      string
  filters:   Record<string, unknown>
  createdAt: string
}

export const getSavedViews = () =>
  apiFetch<SavedView[]>('/api/saved-views')

export const createSavedView = (name: string, filters: Record<string, unknown>) =>
  apiFetch<SavedView>('/api/saved-views', {
    method: 'POST',
    body: JSON.stringify({ name, filters }),
  })

export const deleteSavedView = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/saved-views/${id}`, { method: 'DELETE' })
```

- [ ] **Step 2: Add saved views UI to LeadsPage.tsx**

Open `frontend/src/pages/shared/LeadsPage.tsx`.

**2a. Add imports:**
```typescript
import { Bookmark, BookmarkCheck, X } from 'lucide-react'
import { getSavedViews, createSavedView, deleteSavedView, type SavedView } from '@/services/savedViewService'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
```

**2b. Add saved view state** (alongside existing filter state):
```typescript
const [savedViews,        setSavedViews]        = useState<SavedView[]>([])
const [activeViewId,      setActiveViewId]       = useState<string | null>(null)
const [savingView,        setSavingView]         = useState(false)
const [saveViewName,      setSaveViewName]       = useState('')
const [showSaveViewInput, setShowSaveViewInput]  = useState(false)
```

**2c. Load saved views on mount:**
```typescript
useEffect(() => {
  void getSavedViews()
    .then(setSavedViews)
    .catch(() => {/* silently ignore */})
}, [])
```

**2d. Define the current filter snapshot** (a plain object representing the current filter state):
```typescript
const currentFilters = useMemo(() => ({
  searchTerm,
  stageFilter,
  solutionFilter,
  ageFilter,
  expiryFilter,
}), [searchTerm, stageFilter, solutionFilter, ageFilter, expiryFilter])
```

**2e. Add save and load handlers:**
```typescript
const handleSaveView = async () => {
  if (!saveViewName.trim()) return
  setSavingView(true)
  try {
    const view = await createSavedView(saveViewName.trim(), currentFilters)
    setSavedViews(prev => [...prev, view])
    setActiveViewId(view.id)
    setSaveViewName('')
    setShowSaveViewInput(false)
    toast.success(`View "${view.name}" saved`)
  } catch {
    toast.error('Failed to save view')
  } finally {
    setSavingView(false)
  }
}

const handleLoadView = (view: SavedView) => {
  const f = view.filters as Record<string, string>
  setSearchTerm(f.searchTerm    ?? '')
  setStageFilter(f.stageFilter  ?? 'all')
  setSolutionFilter(f.solutionFilter ?? 'all')
  setAgeFilter((f.ageFilter     ?? 'all') as typeof ageFilter)
  setExpiryFilter((f.expiryFilter ?? 'none') as typeof expiryFilter)
  setActiveViewId(view.id)
}

const handleDeleteView = async (id: string, e: React.MouseEvent) => {
  e.stopPropagation()
  try {
    await deleteSavedView(id)
    setSavedViews(prev => prev.filter(v => v.id !== id))
    if (activeViewId === id) setActiveViewId(null)
    toast.success('View deleted')
  } catch {
    toast.error('Failed to delete view')
  }
}
```

**2f. Add the saved views UI** — insert this block in the filters area (after the existing filter controls, before the leads grid):

```tsx
{/* Saved views row */}
<div className="flex items-center gap-2 flex-wrap">
  {savedViews.map(view => (
    <div
      key={view.id}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border cursor-pointer transition-colors
        ${activeViewId === view.id
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-muted hover:bg-muted/80 border-border'}`}
      onClick={() => handleLoadView(view)}
    >
      <BookmarkCheck className="h-3 w-3" />
      {view.name}
      <button
        className="ml-1 opacity-60 hover:opacity-100"
        onClick={e => handleDeleteView(view.id, e)}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  ))}

  {/* Save current filters button */}
  {hasActiveFilters && !showSaveViewInput && (
    <button
      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-muted-foreground/50 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      onClick={() => setShowSaveViewInput(true)}
    >
      <Bookmark className="h-3 w-3" />
      Save view
    </button>
  )}

  {showSaveViewInput && (
    <div className="flex items-center gap-1.5">
      <input
        className="h-7 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder="View name…"
        value={saveViewName}
        onChange={e => setSaveViewName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') void handleSaveView()
          if (e.key === 'Escape') { setShowSaveViewInput(false); setSaveViewName('') }
        }}
        autoFocus
      />
      <Button size="sm" className="h-7 text-xs" onClick={handleSaveView} disabled={savingView || !saveViewName.trim()}>
        Save
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowSaveViewInput(false); setSaveViewName('') }}>
        Cancel
      </Button>
    </div>
  )}
</div>
```

> **Note on `ageFilter` / `expiryFilter` type casting:** These filters have specific union types. The `handleLoadView` function casts them with `as typeof ageFilter`. This is safe because saved views only store values that were valid when the view was created. If TypeScript complains, check the exact type of `ageFilter` in the existing `useState` call and adjust the cast accordingly.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "d:/Project/Sale Funnel/frontend" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "d:/Project/Sale Funnel"
git add frontend/src/services/savedViewService.ts frontend/src/pages/shared/LeadsPage.tsx
git commit -m "feat(leads): add saved filter views to leads page"
```

---

## Task 5: Final verification + push branch

- [ ] **Step 1: Run TypeScript on both**

```bash
cd "d:/Project/Sale Funnel/frontend" && npx tsc --noEmit
cd "d:/Project/Sale Funnel/backend"  && npx tsc --noEmit
```

- [ ] **Step 2: Build Docker to verify production build**

```bash
cd "d:/Project/Sale Funnel" && docker compose build
```

Expected: both images build with no errors.

- [ ] **Step 3: Push feature branch**

```bash
cd "d:/Project/Sale Funnel" && git push -u origin feature/group2-bulk-filter
```

Do NOT merge to main — user will review and merge manually.
