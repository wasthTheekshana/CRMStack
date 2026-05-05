# Revenue by Solution Drill-Down — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a slice of the Revenue by Solution pie chart opens a read-only slide-in Sheet listing every lead belonging to that solution.

**Architecture:** Add an `onSliceClick` callback to `SolutionPieChart`, create a new `SolutionLeadsSheet` component that renders the Sheet with a compact read-only lead list, and wire both together inside `AnalyticsPage` with a `selectedSolution` state.

**Tech Stack:** React, shadcn/ui Sheet + Badge, Recharts (existing), Tailwind CSS, existing `getRiskLevel` / `formatCurrency` utilities.

---

## Files

| Action | Path |
|---|---|
| Modify | `frontend/src/components/charts/SolutionPieChart.tsx` |
| Create | `frontend/src/components/charts/SolutionLeadsSheet.tsx` |
| Modify | `frontend/src/pages/shared/AnalyticsPage.tsx` |

---

## Implementation Notes

### "Others" label
`processChartData(data, 8)` uses `topCount = 8`, so `topItems = sorted.slice(0, 7)` (7 individual slices) and everything from index 7 onwards is grouped. The label on the chart entry is `Others (${otherItems.length})` — e.g. `"Others (3)"`. When that slice is clicked, `selectedSolution` will be `"Others (3)"`. Use `startsWith('Others')` to detect it, not a strict equality check.

### "Others" threshold replication
`useSolutionData()` returns leads sorted by revenue descending — the same ordering `processChartData` applies. So `solutionData.slice(0, 7)` gives exactly the 7 solutions that appear as individual chart slices.

---

## Task 1: Add `onSliceClick` to `SolutionPieChart`

**Files:**
- Modify: `frontend/src/components/charts/SolutionPieChart.tsx`

- [ ] **Step 1: Add optional prop to `SolutionPieChartProps`**

In `frontend/src/components/charts/SolutionPieChart.tsx`, change the interface from:

```ts
interface SolutionPieChartProps {
  data: SolutionData[]
  title?: string
}
```

to:

```ts
interface SolutionPieChartProps {
  data: SolutionData[]
  title?: string
  onSliceClick?: (solution: string) => void
}
```

- [ ] **Step 2: Destructure the new prop in the component**

Change the function signature from:

```ts
export function SolutionPieChart({
  data,
  title = 'Revenue by Solution',
}: SolutionPieChartProps) {
```

to:

```ts
export function SolutionPieChart({
  data,
  title = 'Revenue by Solution',
  onSliceClick,
}: SolutionPieChartProps) {
```

- [ ] **Step 3: Wire `onClick` on each `Cell`**

The `Cell` elements inside the `Pie` currently look like:

```tsx
{chartData.map((entry, index) => (
  <Cell
    key={`cell-${index}`}
    fill={entry.color}
    opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
    style={{
      transition: 'opacity 0.2s ease-in-out',
      cursor: 'pointer'
    }}
  />
))}
```

Add an `onClick` handler:

```tsx
{chartData.map((entry, index) => (
  <Cell
    key={`cell-${index}`}
    fill={entry.color}
    opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
    style={{
      transition: 'opacity 0.2s ease-in-out',
      cursor: 'pointer'
    }}
    onClick={() => onSliceClick?.(entry.solution)}
  />
))}
```

- [ ] **Step 4: Also wire clicks on the legend rows**

The legend `div` items in the custom legend section currently have `onMouseEnter` and `onMouseLeave`. Add `onClick` too so the legend is also clickable:

```tsx
<div
  key={index}
  className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
    activeIndex === index ? 'bg-gray-100' : 'hover:bg-gray-50'
  }`}
  onMouseEnter={() => setActiveIndex(index)}
  onMouseLeave={() => setActiveIndex(null)}
  onClick={() => onSliceClick?.(entry.solution)}
>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run from `frontend/`:
```
npx tsc --noEmit
```
Expected: no errors related to `SolutionPieChart`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/charts/SolutionPieChart.tsx
git commit -m "feat: add onSliceClick callback to SolutionPieChart"
```

---

## Task 2: Create `SolutionLeadsSheet`

**Files:**
- Create: `frontend/src/components/charts/SolutionLeadsSheet.tsx`

- [ ] **Step 1: Create the file with all imports and the component**

Create `frontend/src/components/charts/SolutionLeadsSheet.tsx` with the following content:

```tsx
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Lead } from '@/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { getRiskLevel } from '@/config/constants'
import { useStageColor } from '@/store/tenantStore'

interface Props {
  open: boolean
  solution: string
  leads: Lead[]
  onClose: () => void
}

export function SolutionLeadsSheet({ open, solution, leads, onClose }: Props) {
  const getStageColor = useStageColor()
  const total = leads.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[440px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>{solution}</SheetTitle>
          <SheetDescription>
            {leads.length} {leads.length === 1 ? 'lead' : 'leads'} · Total: {formatCurrency(total)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No leads found for this solution.
            </p>
          ) : (
            leads.map((lead) => {
              const risk = getRiskLevel(lead.probability)
              const stageColor = getStageColor(lead.salesStage)
              return (
                <div
                  key={lead.id}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{lead.companyName}</span>
                    <Badge
                      className="flex-shrink-0 text-white text-[10px] px-1.5 py-0"
                      style={{ backgroundColor: stageColor }}
                    >
                      {lead.salesStage}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-green-700">
                      {formatCurrency(lead.estimatedRevenue)}
                    </span>
                    <div
                      className="h-1.5 w-16 bg-muted rounded-full overflow-hidden"
                      title={`${lead.probability}% probability`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${lead.probability}%`,
                          backgroundColor: risk.color,
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground truncate">{lead.ownerEmail}</p>
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `frontend/`:
```
npx tsc --noEmit
```
Expected: no errors related to `SolutionLeadsSheet`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/charts/SolutionLeadsSheet.tsx
git commit -m "feat: add SolutionLeadsSheet component"
```

---

## Task 3: Wire up `AnalyticsPage`

**Files:**
- Modify: `frontend/src/pages/shared/AnalyticsPage.tsx`

- [ ] **Step 1: Import `SolutionLeadsSheet`**

At the top of `frontend/src/pages/shared/AnalyticsPage.tsx`, after the existing chart imports, add:

```ts
import { SolutionLeadsSheet } from '@/components/charts/SolutionLeadsSheet'
```

- [ ] **Step 2: Add `selectedSolution` state**

Inside `AnalyticsPage`, after the existing state declarations (`stageFilter`, `solutionFilter`, `filtersOpen`), add:

```ts
const [selectedSolution, setSelectedSolution] = useState<string | null>(null)
```

- [ ] **Step 3: Compute `sheetLeads`**

After `const solutionData = useSolutionData(filteredLeads)`, add:

```ts
const sheetLeads = useMemo(() => {
  if (!selectedSolution) return []
  if (selectedSolution.startsWith('Others')) {
    const top7 = new Set(solutionData.slice(0, 7).map(d => d.solution))
    return filteredLeads.filter(l => !top7.has(l.solution || 'Other'))
  }
  return filteredLeads.filter(l => (l.solution || 'Other') === selectedSolution)
}, [selectedSolution, solutionData, filteredLeads])
```

- [ ] **Step 4: Pass `onSliceClick` to `SolutionPieChart`**

Find the `SolutionPieChart` usage in the JSX:

```tsx
<SolutionPieChart data={solutionData} title="Revenue by Solution" />
```

Change it to:

```tsx
<SolutionPieChart
  data={solutionData}
  title="Revenue by Solution"
  onSliceClick={setSelectedSolution}
/>
```

- [ ] **Step 5: Render `SolutionLeadsSheet` at the bottom of the page**

Just before the closing `</div>` of the outer `<div className="space-y-4 md:space-y-6">`, add:

```tsx
<SolutionLeadsSheet
  open={!!selectedSolution}
  solution={selectedSolution ?? ''}
  leads={sheetLeads}
  onClose={() => setSelectedSolution(null)}
/>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run from `frontend/`:
```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Manual smoke test**

1. Start the dev server: `npm run dev` (from `frontend/`)
2. Navigate to the Analytics page
3. Click any slice on the "Revenue by Solution" pie chart
4. Verify: a right-side Sheet slides in with the solution name as title, the correct lead count and total revenue in the subtitle, and a list of lead cards
5. Click the "Others (N)" slice if present — verify it shows the leads NOT in the top 7 solutions
6. Close the sheet (X button or click backdrop) — verify `selectedSolution` resets and the sheet closes
7. Click a legend row — verify it also triggers the sheet

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/shared/AnalyticsPage.tsx
git commit -m "feat: wire SolutionLeadsSheet drill-down into AnalyticsPage"
```
