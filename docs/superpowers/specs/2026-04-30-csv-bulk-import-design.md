# CSV / Excel Bulk Import — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow tenant admins to upload a `.csv` or `.xlsx` spreadsheet and bulk-import leads, with automatic column mapping, duplicate detection, and per-row conflict resolution.

**Architecture:** Hybrid — frontend parses the file for instant preview and column mapping, backend validates rows against the DB (duplicate detection, owner lookup, field validation), frontend confirms final actions, backend executes the import.

**Tech Stack:** papaparse (CSV parsing — already installed), xlsx (Excel parsing — already installed), React wizard modal, two new Express endpoints, existing `createLead` / `updateLead` model functions.

---

## User Flow — 3-Step Wizard Modal

```
Leads Page (admin only)
  └── "Import" button → opens ImportLeadsModal

Step 1 — Upload & Map
  ├── Drag-and-drop zone or file picker (.csv, .xlsx, .xls — max 1,000 rows)
  ├── Frontend parses file instantly (papaparse / xlsx)
  ├── Shows: "312 rows detected, 8 columns"
  ├── Auto-maps columns using fuzzy header matching
  ├── Mapping table: spreadsheet column → CRM field dropdown (or "Don't import")
  └── "Preview Import" button → proceeds to Step 2

Step 2 — Review & Resolve
  ├── Frontend sends mapped rows to POST /api/leads/import/preview
  ├── Backend checks each company_name against existing leads (tenant-scoped)
  ├── Returns rows tagged: new | duplicate (with existing lead details)
  ├── Table shows all rows with status badges (🟢 New / 🟡 Duplicate)
  ├── Duplicate rows show existing lead + radio: Skip / Overwrite
  ├── Summary bar: "42 new · 8 duplicates to resolve"
  ├── "Import X Leads" button (disabled until all duplicates have a decision)
  └── Clicking → POST /api/leads/import/confirm

Step 3 — Result Summary
  ├── ✅ X created · 🔄 X updated · ⏭ X skipped
  ├── Row-level errors listed (e.g. "Row 12: invalid stage name")
  └── "Done" closes modal + refreshes leads list
```

---

## File Map

**Create:**
- `frontend/src/components/leads/ImportLeadsModal.tsx`
- `frontend/src/components/leads/ImportStep1Upload.tsx`
- `frontend/src/components/leads/ImportStep2Preview.tsx`
- `frontend/src/components/leads/ImportStep3Result.tsx`
- `frontend/src/lib/importParser.ts`
- `backend/src/controllers/importController.ts`
- `backend/src/routes/import.ts`

**Modify:**
- `frontend/src/pages/shared/LeadsPage.tsx` — add Import button (admin only)
- `backend/src/routes/index.ts` — mount `/leads/import`

---

## Backend API

### `POST /api/leads/import/preview`

**Auth:** requireAuth + admin role only

**Request body:**
```typescript
{
  rows: Array<{
    companyName:      string;
    solution:         string;
    salesStage:       string;
    estimatedRevenue: string;   // raw string, backend parses
    probability:      string;
    remarks:          string;
    hoUpdate:         string;
    imageCount:       string;
    boxCount:         string;
    contactName:      string;
    contactPhone:     string;
    contactEmail:     string;
    ownerEmail:       string;
  }>
}
```

**Response:**
```typescript
{
  totalNew:        number;
  totalDuplicates: number;
  rows: Array<{
    index:         number;        // original row position
    status:        'new' | 'duplicate';
    parsed: {                     // validated/coerced values
      companyName:      string;
      solution:         string;   // validated against tenant solutions
      salesStage:       string;   // validated against tenant stages
      estimatedRevenue: number;
      probability:      number;
      remarks:          string;
      hoUpdate:         string;
      imageCount:        number;
      boxCount:          number;
      contacts:          Contact[];
      ownerId:           string;   // resolved from ownerEmail or importing admin
      ownerEmail:        string;
    };
    existingLead?: {              // only when status = 'duplicate'
      id:          string;
      companyName: string;
      salesStage:  string;
      ownerId:     string;
      ownerEmail:  string;
    };
    warnings: string[];           // e.g. "solution 'Docs' not found — left blank"
  }>
}
```

**Backend validation rules:**
- `companyName` blank → row marked as error, excluded from results
- `salesStage` not in tenant stages → fallback to tenant's first stage, add warning
- `solution` not in tenant solutions → left blank, add warning
- `probability` blank → use stage's default probability from tenant config
- `ownerEmail` not found in tenant users → fallback to importing admin's ID, add warning
- `estimatedRevenue`, `imageCount`, `boxCount` non-numeric → default 0, add warning

**Duplicate detection:**
```sql
SELECT id, company_name, sales_stage, owner_id, owner_email
FROM leads
WHERE tenant_id = $1
  AND is_deleted = FALSE
  AND LOWER(TRIM(company_name)) = LOWER(TRIM($2))
```

---

### `POST /api/leads/import/confirm`

**Auth:** requireAuth + admin role only

**Request body:**
```typescript
{
  rows: Array<{
    index:      number;
    action:     'create' | 'update' | 'skip';
    existingId?: string;   // required when action = 'update'
    data: {                // same parsed shape from preview
      companyName:      string;
      solution:         string;
      salesStage:       string;
      estimatedRevenue: number;
      probability:      number;
      remarks:          string;
      hoUpdate:         string;
      imageCount:        number;
      boxCount:          number;
      contacts:          Contact[];
      ownerId:           string;
      ownerEmail:        string;
    };
  }>
}
```

**Response:**
```typescript
{
  created: number;
  updated: number;
  skipped: number;
  errors:  Array<{ row: number; reason: string }>;
}
```

**Backend execution:**
- `action: 'create'` → calls `createLead(data)` with `tenantId` from JWT
- `action: 'update'` → calls `updateLead(existingId, tenantId, data)`
- `action: 'skip'`   → no DB operation, counted in skipped
- All creates/updates run in a single PostgreSQL transaction — if any row throws an unexpected error, it is caught individually (not rolled back globally) and added to `errors[]`
- Max 1,000 rows enforced — return 400 if exceeded

---

## Frontend Components

### `importParser.ts`

```typescript
export interface ParsedSpreadsheet {
  headers: string[];
  rows:    Record<string, string>[];
}

export interface ColumnMapping {
  [spreadsheetHeader: string]: CrmField | null;
}

export type CrmField =
  | 'companyName' | 'solution' | 'salesStage'
  | 'estimatedRevenue' | 'probability' | 'remarks' | 'hoUpdate'
  | 'imageCount' | 'boxCount'
  | 'contactName' | 'contactPhone' | 'contactEmail'
  | 'ownerEmail';

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet>
export function autoMapColumns(headers: string[]): ColumnMapping
export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): MappedRow[]
```

**Auto-map aliases (case-insensitive, partial match):**

| Spreadsheet header contains | Maps to |
|---|---|
| company, organisation, organization, client | companyName |
| solution, product, service, category | solution |
| stage, pipeline, status | salesStage |
| revenue, value, deal value, amount | estimatedRevenue |
| probability, chance, likelihood | probability |
| remark, note, comment | remarks |
| ho update, head office, ho | hoUpdate |
| image, images, image count | imageCount |
| box, boxes, box count | boxCount |
| contact name, contact, person, name | contactName |
| phone, mobile, tel, telephone | contactPhone |
| contact email, email | contactEmail |
| owner, assigned, rep, sales rep, owner email | ownerEmail |

---

### `ImportLeadsModal.tsx`

- shadcn `Dialog` wrapping a 3-step wizard
- State: `step: 1 | 2 | 3`, `file`, `headers`, `rows`, `mapping`, `previewResult`, `importResult`
- Step indicator bar at top (Step 1 → Step 2 → Step 3)
- Renders `ImportStep1Upload`, `ImportStep2Preview`, or `ImportStep3Result` based on `step`

---

### `ImportStep1Upload.tsx`

- Drag-and-drop zone (accepts `.csv`, `.xlsx`, `.xls`)
- On file drop/select: calls `parseSpreadsheet(file)` → shows row/column counts
- Renders mapping table:
  ```
  Spreadsheet Column    →    CRM Field
  ─────────────────────────────────────
  Company               →    [Company Name ▼]
  Stage                 →    [Sales Stage  ▼]
  Value                 →    [Est. Revenue ▼]
  Notes                 →    [Don't Import ▼]
  ```
- Each dropdown shows all CRM fields + "Don't Import"
- "Preview Import →" button (disabled until file loaded and required fields mapped: Company Name, Sales Stage)

---

### `ImportStep2Preview.tsx`

- Calls `POST /api/leads/import/preview` on mount with mapped rows
- Shows loading spinner while waiting
- Summary bar: "42 new · 8 duplicates · 2 warnings"
- Table columns: Row #, Company Name, Stage, Revenue, Owner, Status
- Status badge: 🟢 New / 🟡 Duplicate / ⚠️ Warning
- Duplicate rows expandable: shows existing lead details + radio Skip/Overwrite
- Warning rows show tooltip with warning message
- "Import [N] Leads" button — disabled until every duplicate has Skip or Overwrite selected
- "← Back" returns to Step 1

---

### `ImportStep3Result.tsx`

- Shows result counts: ✅ Created / 🔄 Updated / ⏭ Skipped
- If `errors.length > 0`: collapsible error list showing row number + reason
- "Done" button: closes modal, calls `onComplete()` which refreshes leads list

---

## Leads Page Changes

`LeadsPage.tsx` — admin-only "Import" button added to the page header alongside the existing "Add Lead" button:

```tsx
{isAdmin && (
  <Button variant="outline" onClick={() => setImportOpen(true)}>
    <Upload className="h-4 w-4 mr-2" />
    Import
  </Button>
)}
<ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} onComplete={refetchLeads} />
```

---

## Security & Constraints

- Both endpoints are admin-only (role check in controller)
- All DB operations are scoped to `req.user.tenantId`
- Max 1,000 rows per upload — enforced on both frontend (file parse) and backend (confirm endpoint)
- No file is stored on the server — rows arrive as JSON in request body
- `ownerEmail` lookup is tenant-scoped — cannot assign to users from other tenants
- Duplicate detection is case-insensitive and trim-normalized

---

## Error States

| Scenario | Handling |
|---|---|
| File too large (> 5 MB) | Frontend rejects before parsing |
| More than 1,000 rows | Frontend shows error after parse, blocks Step 2 |
| No `companyName` column mapped | "Preview Import" button disabled |
| All rows are duplicates set to Skip | Confirm button says "Skip 50 Rows" — allowed |
| Backend preview fails (network) | Step 2 shows error with Retry button |
| Individual row DB error during confirm | Counted in errors[], rest of import continues |
