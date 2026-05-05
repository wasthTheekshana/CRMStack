# Revenue by Solution Drill-Down — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a slice of the Revenue by Solution pie chart on the Analytics page opens a read-only slide-in Sheet listing every lead belonging to that solution.

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

## Design Details

### SolutionPieChart changes
- Add optional prop `onSliceClick?: (solution: string) => void`
- Add `onClick` on each `Cell` — fires `onSliceClick(entry.name)`
- When `onSliceClick` is provided, set `cursor="pointer"` on the `Pie`
- No other changes; hover behaviour unchanged

### SolutionLeadsSheet
Props:
```ts
interface Props {
  open: boolean
  solution: string        // display name, e.g. "CCTV" or "Others"
  leads: Lead[]           // already filtered to this solution by parent
  onClose: () => void
}
```
Layout:
- `SheetHeader`: title = `"{solution}"`, description = `"{n} leads · Total: {formatCurrency(sum)}`
- Scrollable `SheetContent`: list of read-only lead cards
- Each card shows:
  - Company name (font-medium, truncated)
  - Stage — coloured `Badge` using `useStageColor()`
  - Estimated revenue (`formatCurrency`)
  - Probability bar (same colour/width logic as KanbanCard)
  - Owner email (muted, truncated)
- Empty state: "No leads found for this solution."

### AnalyticsPage changes
- Add state: `const [selectedSolution, setSelectedSolution] = useState<string | null>(null)`
- Compute `sheetLeads`:
  - If `selectedSolution !== 'Others'`: `filteredLeads.filter(l => (l.solution || 'Other') === selectedSolution)`
  - If `selectedSolution === 'Others'`: determine the top-8 solution names from `solutionData`, then return leads whose solution is **not** in that set
- Pass `onSliceClick={setSelectedSolution}` to `SolutionPieChart`
- Render `<SolutionLeadsSheet>` at the bottom of the page (always mounted, `open={!!selectedSolution}`)

### "Others" bucket logic
`SolutionPieChart.processChartData()` groups solutions ranked 9+ into "Others". `AnalyticsPage` replicates the threshold:
```ts
const top8 = new Set(solutionData.slice(0, 8).map(d => d.solution))
const sheetLeads = selectedSolution === 'Others'
  ? filteredLeads.filter(l => !top8.has(l.solution || 'Other'))
  : filteredLeads.filter(l => (l.solution || 'Other') === selectedSolution)
```
This keeps the threshold in one place and avoids coupling AnalyticsPage to SolutionPieChart internals.
