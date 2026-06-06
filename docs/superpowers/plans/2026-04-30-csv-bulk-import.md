# CSV / Excel Bulk Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow tenant admins to upload a `.csv` or `.xlsx` spreadsheet and bulk-import leads with automatic column mapping, duplicate detection, and per-row conflict resolution.

**Architecture:** Hybrid — frontend parses the file instantly for column mapping and preview, backend validates rows against the DB (duplicate detection, owner lookup, field validation), then executes the confirmed import. Two new Express endpoints, one frontend parser utility, one 3-step modal wizard.

**Tech Stack:** Express/TypeScript backend, papaparse (CSV), xlsx (Excel), React 18, shadcn Dialog, Zustand auth store, existing `createLead`/`updateLead` model functions.

---

## File Map

**Create:**
- `backend/src/controllers/importController.ts` — preview + confirm handlers
- `backend/src/routes/import.ts` — mounts both endpoints under `/leads/import`
- `frontend/src/lib/api/importApi.ts` — typed API calls for preview + confirm
- `frontend/src/lib/importParser.ts` — file parsing, auto-mapping, row mapping
- `frontend/src/components/leads/ImportLeadsModal.tsx` — 3-step wizard shell
- `frontend/src/components/leads/ImportStep1Upload.tsx` — file drop + column mapping
- `frontend/src/components/leads/ImportStep2Preview.tsx` — duplicate resolution table
- `frontend/src/components/leads/ImportStep3Result.tsx` — summary screen

**Modify:**
- `backend/src/models/userModel.ts` — add `findUserByEmailInTenant`
- `backend/src/routes/index.ts` — mount import routes
- `frontend/src/pages/shared/LeadsPage.tsx` — add Import button + modal

---

## Task 1: Backend — User Model Helper

**Files:**
- Modify: `backend/src/models/userModel.ts`

- [ ] **Step 1: Add `findUserByEmailInTenant` to userModel**

Open `backend/src/models/userModel.ts` and append this function after the existing exports:

```typescript
export async function findUserByEmailInTenant(
  email: string,
  tenantId: string
): Promise<{ id: string; email: string; displayName: string } | null> {
  const result = await query(
    `SELECT id, email, display_name
     FROM users
     WHERE LOWER(email) = LOWER($1)
       AND tenant_id = $2
       AND is_active = TRUE`,
    [email.trim(), tenantId]
  );
  if (!result.rows[0]) return null;
  return {
    id:          result.rows[0].id as string,
    email:       result.rows[0].email as string,
    displayName: result.rows[0].display_name as string,
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 2: Backend — Import Controller

**Files:**
- Create: `backend/src/controllers/importController.ts`

- [ ] **Step 1: Create the controller file**

Create `backend/src/controllers/importController.ts`:

```typescript
import { Request, Response } from 'express';
import { query } from '../config/db';
import { createLead, updateLead } from '../models/leadModel';
import { findConfigByTenantId, DEFAULT_STAGES, DEFAULT_SOLUTIONS } from '../models/tenantConfigModel';
import { findUserByEmailInTenant } from '../models/userModel';

// ─── Shared types ─────────────────────────────────────────────────────────────

interface ImportRow {
  companyName:      string;
  solution:         string;
  salesStage:       string;
  estimatedRevenue: string;
  probability:      string;
  remarks:          string;
  hoUpdate:         string;
  imageCount:       string;
  boxCount:         string;
  contactName:      string;
  contactPhone:     string;
  contactEmail:     string;
  ownerEmail:       string;
}

interface ParsedRow {
  companyName:      string;
  solution:         string;
  salesStage:       string;
  estimatedRevenue: number;
  probability:      number;
  remarks:          string;
  hoUpdate:         string;
  imageCount:       number;
  boxCount:         number;
  contacts:         { name: string; phone: string; email: string; isPrimary: boolean }[];
  ownerId:          string;
  ownerEmail:       string;
}

// ─── Helper: parse and validate a single row ──────────────────────────────────

async function parseRow(
  raw: ImportRow,
  tenantId: string,
  adminId: string,
  adminEmail: string,
  stageNames: string[],
  solutionNames: string[],
  defaultProbabilityMap: Record<string, number>
): Promise<{ parsed: ParsedRow; warnings: string[] }> {
  const warnings: string[] = [];

  // Sales stage
  let salesStage = raw.salesStage?.trim() || '';
  if (!stageNames.includes(salesStage)) {
    if (salesStage) warnings.push(`Stage "${salesStage}" not found — using "${stageNames[0]}"`);
    salesStage = stageNames[0];
  }

  // Solution
  let solution = raw.solution?.trim() || '';
  if (solution && !solutionNames.includes(solution)) {
    warnings.push(`Solution "${solution}" not found — left blank`);
    solution = '';
  }

  // Probability
  let probability = parseInt(raw.probability, 10);
  if (isNaN(probability)) {
    probability = defaultProbabilityMap[salesStage] ?? 0;
  }
  probability = Math.max(0, Math.min(100, probability));

  // Numeric fields
  let estimatedRevenue = parseFloat(raw.estimatedRevenue);
  if (isNaN(estimatedRevenue)) { estimatedRevenue = 0; }

  let imageCount = parseInt(raw.imageCount, 10);
  if (isNaN(imageCount)) { imageCount = 0; }

  let boxCount = parseInt(raw.boxCount, 10);
  if (isNaN(boxCount)) { boxCount = 0; }

  // Owner
  let ownerId = adminId;
  let ownerEmail = adminEmail;
  const rawOwnerEmail = raw.ownerEmail?.trim();
  if (rawOwnerEmail) {
    const user = await findUserByEmailInTenant(rawOwnerEmail, tenantId);
    if (user) {
      ownerId    = user.id;
      ownerEmail = user.email;
    } else {
      warnings.push(`Owner "${rawOwnerEmail}" not found — assigned to you`);
    }
  }

  // Contact
  const contacts = raw.contactName?.trim()
    ? [{ name: raw.contactName.trim(), phone: raw.contactPhone?.trim() || '', email: raw.contactEmail?.trim() || '', isPrimary: true }]
    : [];

  return {
    parsed: {
      companyName: raw.companyName.trim(),
      solution,
      salesStage,
      estimatedRevenue,
      probability,
      remarks:  raw.remarks?.trim()  || '',
      hoUpdate: raw.hoUpdate?.trim() || '',
      imageCount,
      boxCount,
      contacts,
      ownerId,
      ownerEmail,
    },
    warnings,
  };
}

// ─── POST /api/leads/import/preview ──────────────────────────────────────────

export async function importPreview(req: Request, res: Response) {
  const { rows } = req.body as { rows: ImportRow[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'rows array is required' });
    return;
  }
  if (rows.length > 1000) {
    res.status(400).json({ error: 'Maximum 1,000 rows per import' });
    return;
  }

  const tenantId   = req.user!.tenantId;
  const adminId    = req.user!.userId;
  const adminEmail = req.user!.email;

  // Load tenant config for stage/solution validation
  const config    = await findConfigByTenantId(tenantId);
  const stages    = config?.salesStages   ?? DEFAULT_STAGES;
  const solutions = config?.solutions     ?? DEFAULT_SOLUTIONS;
  const stageNames    = stages.map(s => s.name);
  const solutionNames = solutions.map(s => s.name);
  const defaultProbabilityMap: Record<string, number> = {};
  stages.forEach(s => { defaultProbabilityMap[s.name] = s.probability; });

  const result: {
    index: number;
    status: 'new' | 'duplicate';
    parsed: ParsedRow;
    existingLead?: { id: string; companyName: string; salesStage: string; ownerId: string; ownerEmail: string };
    warnings: string[];
  }[] = [];

  let totalNew = 0;
  let totalDuplicates = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw.companyName?.trim()) continue; // skip blank company rows

    const { parsed, warnings } = await parseRow(
      raw, tenantId, adminId, adminEmail,
      stageNames, solutionNames, defaultProbabilityMap
    );

    // Duplicate detection
    const dupResult = await query(
      `SELECT id, company_name, sales_stage, owner_id, owner_email
       FROM leads
       WHERE tenant_id = $1
         AND is_deleted = FALSE
         AND LOWER(TRIM(company_name)) = LOWER(TRIM($2))`,
      [tenantId, parsed.companyName]
    );

    if (dupResult.rows[0]) {
      totalDuplicates++;
      result.push({
        index: i,
        status: 'duplicate',
        parsed,
        existingLead: {
          id:          dupResult.rows[0].id          as string,
          companyName: dupResult.rows[0].company_name as string,
          salesStage:  dupResult.rows[0].sales_stage  as string,
          ownerId:     dupResult.rows[0].owner_id     as string,
          ownerEmail:  dupResult.rows[0].owner_email  as string,
        },
        warnings,
      });
    } else {
      totalNew++;
      result.push({ index: i, status: 'new', parsed, warnings });
    }
  }

  res.json({ totalNew, totalDuplicates, rows: result });
}

// ─── POST /api/leads/import/confirm ──────────────────────────────────────────

export async function importConfirm(req: Request, res: Response) {
  const { rows } = req.body as {
    rows: Array<{
      index:       number;
      action:      'create' | 'update' | 'skip';
      existingId?: string;
      data:        ParsedRow;
    }>;
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'rows array is required' });
    return;
  }
  if (rows.length > 1000) {
    res.status(400).json({ error: 'Maximum 1,000 rows per import' });
    return;
  }

  const tenantId = req.user!.tenantId;
  let created = 0, updated = 0, skipped = 0;
  const errors: { row: number; reason: string }[] = [];

  for (const row of rows) {
    if (row.action === 'skip') {
      skipped++;
      continue;
    }

    try {
      if (row.action === 'create') {
        await createLead({
          ...row.data,
          position:   null,
          tenantId,
          customFields: {},
        });
        created++;
      } else if (row.action === 'update' && row.existingId) {
        await updateLead(row.existingId, tenantId, row.data);
        updated++;
      }
    } catch (err) {
      errors.push({ row: row.index, reason: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  res.json({ created, updated, skipped, errors });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 3: Backend — Import Routes + Mount

**Files:**
- Create: `backend/src/routes/import.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create import routes file**

Create `backend/src/routes/import.ts`:

```typescript
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { importPreview, importConfirm } from '../controllers/importController';

const router = Router();

router.post('/preview', requireAuth, requireAdmin, importPreview);
router.post('/confirm', requireAuth, requireAdmin, importConfirm);

export default router;
```

- [ ] **Step 2: Mount in routes/index.ts**

Open `backend/src/routes/index.ts`. Add the import and mount:

```typescript
import importRoutes from './import';
```

Add the mount line alongside the other routes:

```typescript
router.use('/leads/import', importRoutes);
```

- [ ] **Step 3: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/backend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: Frontend — Import API Client

**Files:**
- Create: `frontend/src/lib/api/importApi.ts`

- [ ] **Step 1: Create the API file**

Create `frontend/src/lib/api/importApi.ts`:

```typescript
import { apiFetch } from '@/config/api';

export interface ImportRowInput {
  companyName:      string;
  solution:         string;
  salesStage:       string;
  estimatedRevenue: string;
  probability:      string;
  remarks:          string;
  hoUpdate:         string;
  imageCount:       string;
  boxCount:         string;
  contactName:      string;
  contactPhone:     string;
  contactEmail:     string;
  ownerEmail:       string;
}

export interface ParsedLeadData {
  companyName:      string;
  solution:         string;
  salesStage:       string;
  estimatedRevenue: number;
  probability:      number;
  remarks:          string;
  hoUpdate:         string;
  imageCount:       number;
  boxCount:         number;
  contacts:         { name: string; phone: string; email: string; isPrimary: boolean }[];
  ownerId:          string;
  ownerEmail:       string;
}

export interface ExistingLeadInfo {
  id:          string;
  companyName: string;
  salesStage:  string;
  ownerId:     string;
  ownerEmail:  string;
}

export interface PreviewRow {
  index:         number;
  status:        'new' | 'duplicate';
  parsed:        ParsedLeadData;
  existingLead?: ExistingLeadInfo;
  warnings:      string[];
}

export interface PreviewResponse {
  totalNew:        number;
  totalDuplicates: number;
  rows:            PreviewRow[];
}

export interface ConfirmRowInput {
  index:       number;
  action:      'create' | 'update' | 'skip';
  existingId?: string;
  data:        ParsedLeadData;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors:  { row: number; reason: string }[];
}

export async function previewImport(rows: ImportRowInput[]): Promise<PreviewResponse> {
  return apiFetch<PreviewResponse>('/api/leads/import/preview', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}

export async function confirmImport(rows: ConfirmRowInput[]): Promise<ImportResult> {
  return apiFetch<ImportResult>('/api/leads/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Frontend — Import Parser

**Files:**
- Create: `frontend/src/lib/importParser.ts`

- [ ] **Step 1: Create the parser file**

Create `frontend/src/lib/importParser.ts`:

```typescript
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ImportRowInput } from '@/lib/api/importApi';

export type CrmField =
  | 'companyName' | 'solution' | 'salesStage'
  | 'estimatedRevenue' | 'probability' | 'remarks' | 'hoUpdate'
  | 'imageCount' | 'boxCount'
  | 'contactName' | 'contactPhone' | 'contactEmail'
  | 'ownerEmail';

export const CRM_FIELD_LABELS: Record<CrmField, string> = {
  companyName:      'Company Name',
  solution:         'Solution',
  salesStage:       'Sales Stage',
  estimatedRevenue: 'Estimated Revenue',
  probability:      'Probability',
  remarks:          'Remarks',
  hoUpdate:         'HO Update',
  imageCount:       'Image Count',
  boxCount:         'Box Count',
  contactName:      'Contact Name',
  contactPhone:     'Contact Phone',
  contactEmail:     'Contact Email',
  ownerEmail:       'Owner Email',
};

export interface ColumnMapping {
  [spreadsheetHeader: string]: CrmField | null;
}

export interface ParsedSpreadsheet {
  headers: string[];
  rows:    Record<string, string>[];
}

// Alias table for auto-mapping
const ALIASES: { keywords: string[]; field: CrmField }[] = [
  { keywords: ['company', 'organisation', 'organization', 'client', 'account'],      field: 'companyName' },
  { keywords: ['solution', 'product', 'service', 'category'],                         field: 'solution' },
  { keywords: ['stage', 'pipeline', 'status'],                                        field: 'salesStage' },
  { keywords: ['revenue', 'value', 'deal value', 'amount', 'estimated'],              field: 'estimatedRevenue' },
  { keywords: ['probability', 'chance', 'likelihood'],                                field: 'probability' },
  { keywords: ['remark', 'note', 'comment'],                                          field: 'remarks' },
  { keywords: ['ho update', 'head office', 'ho'],                                     field: 'hoUpdate' },
  { keywords: ['image count', 'images', 'image'],                                     field: 'imageCount' },
  { keywords: ['box count', 'boxes', 'box'],                                          field: 'boxCount' },
  { keywords: ['contact name', 'contact person', 'person', 'contact'],                field: 'contactName' },
  { keywords: ['phone', 'mobile', 'tel', 'telephone', 'contact phone'],               field: 'contactPhone' },
  { keywords: ['contact email', 'email'],                                              field: 'contactEmail' },
  { keywords: ['owner email', 'owner', 'assigned to', 'rep', 'sales rep'],            field: 'ownerEmail' },
];

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<CrmField>();

  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    let matched: CrmField | null = null;

    for (const { keywords, field } of ALIASES) {
      if (used.has(field)) continue;
      if (keywords.some(k => lower.includes(k))) {
        matched = field;
        break;
      }
    }

    mapping[header] = matched;
    if (matched) used.add(matched);
  }

  return mapping;
}

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(file, {
        header:        true,
        skipEmptyLines: true,
        complete: (result) => {
          resolve({
            headers: result.meta.fields ?? [],
            rows:    result.data,
          });
        },
        error: reject,
      });
    });
  }

  // xlsx / xls
  const buffer = await file.arrayBuffer();
  const wb     = XLSX.read(buffer, { type: 'array' });
  const ws     = wb.Sheets[wb.SheetNames[0]];
  const raw    = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
  const rows = raw.map(r => {
    const row: Record<string, string> = {};
    for (const key of headers) {
      row[key] = String(r[key] ?? '');
    }
    return row;
  });

  return { headers, rows };
}

export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping
): ImportRowInput[] {
  return rows.map(row => {
    const get = (field: CrmField): string => {
      const header = Object.entries(mapping).find(([, f]) => f === field)?.[0];
      return header ? (row[header] ?? '').trim() : '';
    };

    return {
      companyName:      get('companyName'),
      solution:         get('solution'),
      salesStage:       get('salesStage'),
      estimatedRevenue: get('estimatedRevenue'),
      probability:      get('probability'),
      remarks:          get('remarks'),
      hoUpdate:         get('hoUpdate'),
      imageCount:       get('imageCount'),
      boxCount:         get('boxCount'),
      contactName:      get('contactName'),
      contactPhone:     get('contactPhone'),
      contactEmail:     get('contactEmail'),
      ownerEmail:       get('ownerEmail'),
    };
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: Frontend — Modal Shell

**Files:**
- Create: `frontend/src/components/leads/ImportLeadsModal.tsx`

- [ ] **Step 1: Create the modal shell**

Create `frontend/src/components/leads/ImportLeadsModal.tsx`:

```tsx
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImportStep1Upload } from './ImportStep1Upload'
import { ImportStep2Preview } from './ImportStep2Preview'
import { ImportStep3Result } from './ImportStep3Result'
import type { ColumnMapping, ParsedSpreadsheet } from '@/lib/importParser'
import type { PreviewResponse, ImportResult } from '@/lib/api/importApi'

interface Props {
  open:       boolean;
  onClose:    () => void;
  onComplete: () => void;
}

const STEP_LABELS = ['Upload & Map', 'Review', 'Done'];

export function ImportLeadsModal({ open, onClose, onComplete }: Props) {
  const [step,          setStep]          = useState<1 | 2 | 3>(1)
  const [parsed,        setParsed]        = useState<ParsedSpreadsheet | null>(null)
  const [mapping,       setMapping]       = useState<ColumnMapping>({})
  const [previewResult, setPreviewResult] = useState<PreviewResponse | null>(null)
  const [importResult,  setImportResult]  = useState<ImportResult | null>(null)

  const handleClose = () => {
    setStep(1)
    setParsed(null)
    setMapping({})
    setPreviewResult(null)
    setImportResult(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1
            const active    = step === n
            const completed = step > n
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${
                  active    ? 'bg-primary text-primary-foreground' :
                  completed ? 'bg-primary/20 text-primary' :
                              'bg-muted text-muted-foreground'
                }`}>
                  <span>{n}</span>
                  <span>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-6 ${step > n ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            )
          })}
        </div>

        {step === 1 && (
          <ImportStep1Upload
            onNext={(p, m) => {
              setParsed(p)
              setMapping(m)
              setStep(2)
            }}
          />
        )}

        {step === 2 && parsed && (
          <ImportStep2Preview
            parsed={parsed}
            mapping={mapping}
            onBack={() => setStep(1)}
            onDone={(result) => {
              setImportResult(result)
              setStep(3)
            }}
            onPreviewLoaded={setPreviewResult}
            previewResult={previewResult}
          />
        )}

        {step === 3 && importResult && (
          <ImportStep3Result
            result={importResult}
            onDone={() => {
              onComplete()
              handleClose()
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors (Step components don't exist yet — expect "cannot find module" errors for them only; modal shell itself should be type-clean).

---

## Task 7: Frontend — Step 1 Upload & Map

**Files:**
- Create: `frontend/src/components/leads/ImportStep1Upload.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/leads/ImportStep1Upload.tsx`:

```tsx
import { useState, useRef } from 'react'
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseSpreadsheet, autoMapColumns, CRM_FIELD_LABELS } from '@/lib/importParser'
import type { ColumnMapping, ParsedSpreadsheet, CrmField } from '@/lib/importParser'

const MAX_ROWS = 1000
const MAX_FILE_BYTES = 5 * 1024 * 1024  // 5 MB

const CRM_FIELDS: CrmField[] = [
  'companyName', 'solution', 'salesStage', 'estimatedRevenue', 'probability',
  'remarks', 'hoUpdate', 'imageCount', 'boxCount',
  'contactName', 'contactPhone', 'contactEmail', 'ownerEmail',
]

interface Props {
  onNext: (parsed: ParsedSpreadsheet, mapping: ColumnMapping) => void;
}

export function ImportStep1Upload({ onNext }: Props) {
  const [parsed,   setParsed]   = useState<ParsedSpreadsheet | null>(null)
  const [mapping,  setMapping]  = useState<ColumnMapping>({})
  const [error,    setError]    = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setError('Only .csv, .xlsx, and .xls files are supported.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large. Maximum size is 5 MB.')
      return
    }
    try {
      const result = await parseSpreadsheet(file)
      if (result.rows.length > MAX_ROWS) {
        setError(`File has ${result.rows.length.toLocaleString()} rows. Maximum is 1,000 rows per import.`)
        return
      }
      if (result.rows.length === 0) {
        setError('The file appears to be empty.')
        return
      }
      const auto = autoMapColumns(result.headers)
      setParsed(result)
      setMapping(auto)
    } catch {
      setError('Could not read the file. Make sure it is a valid CSV or Excel file.')
    }
  }

  const canProceed = parsed !== null && Object.values(mapping).includes('companyName')

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Drop a file here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">.csv, .xlsx, .xls — max 1,000 rows, 5 MB</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {parsed && (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span>{parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns detected</span>
          </div>

          {/* Column mapping table */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Map Columns</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Spreadsheet Column</th>
                    <th className="text-left px-4 py-2 font-medium">CRM Field</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.headers.map((header) => (
                    <tr key={header} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{header}</td>
                      <td className="px-4 py-2">
                        <Select
                          value={mapping[header] ?? '__none__'}
                          onValueChange={(val) =>
                            setMapping(prev => ({
                              ...prev,
                              [header]: val === '__none__' ? null : val as CrmField,
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Don't import</SelectItem>
                            {CRM_FIELDS.map(f => (
                              <SelectItem key={f} value={f}>
                                {CRM_FIELD_LABELS[f]}
                                {f === 'companyName' && ' *'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">* Required field</p>
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button
          disabled={!canProceed}
          onClick={() => parsed && onNext(parsed, mapping)}
        >
          Preview Import →
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors (Step2/Step3 still missing — only those import errors expected).

---

## Task 8: Frontend — Step 2 Preview & Resolve

**Files:**
- Create: `frontend/src/components/leads/ImportStep2Preview.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/leads/ImportStep2Preview.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { previewImport, confirmImport } from '@/lib/api/importApi'
import { applyMapping } from '@/lib/importParser'
import type { ColumnMapping, ParsedSpreadsheet } from '@/lib/importParser'
import type { PreviewResponse, PreviewRow, ConfirmRowInput, ImportResult } from '@/lib/api/importApi'

interface Props {
  parsed:            ParsedSpreadsheet;
  mapping:           ColumnMapping;
  previewResult:     PreviewResponse | null;
  onPreviewLoaded:   (r: PreviewResponse) => void;
  onBack:            () => void;
  onDone:            (result: ImportResult) => void;
}

type DuplicateAction = 'skip' | 'overwrite';

export function ImportStep2Preview({
  parsed, mapping, previewResult, onPreviewLoaded, onBack, onDone,
}: Props) {
  const [loading,     setLoading]     = useState(!previewResult)
  const [error,       setError]       = useState<string | null>(null)
  const [confirming,  setConfirming]  = useState(false)
  const [decisions,   setDecisions]   = useState<Record<number, DuplicateAction>>({})

  useEffect(() => {
    if (previewResult) return
    const rows = applyMapping(parsed.rows, mapping)
    setLoading(true)
    setError(null)
    previewImport(rows)
      .then((r) => { onPreviewLoaded(r); setLoading(false) })
      .catch(() => { setError('Failed to load preview. Check your connection and try again.'); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking for duplicates…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>← Back</Button>
          <Button onClick={() => { setError(null); setLoading(true); const rows = applyMapping(parsed.rows, mapping); previewImport(rows).then(r => { onPreviewLoaded(r); setLoading(false) }).catch(() => { setError('Failed to load preview.'); setLoading(false) }) }}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!previewResult) return null

  const duplicateRows   = previewResult.rows.filter(r => r.status === 'duplicate')
  const unresolvedCount = duplicateRows.filter(r => !decisions[r.index]).length
  const totalWarnings   = previewResult.rows.reduce((n, r) => n + r.warnings.length, 0)

  const handleConfirm = async () => {
    setConfirming(true)
    const confirmRows: ConfirmRowInput[] = previewResult.rows.map(row => {
      if (row.status === 'new') {
        return { index: row.index, action: 'create', data: row.parsed }
      }
      const decision = decisions[row.index]
      if (decision === 'overwrite') {
        return { index: row.index, action: 'update', existingId: row.existingLead!.id, data: row.parsed }
      }
      return { index: row.index, action: 'skip', data: row.parsed }
    })
    try {
      const result = await confirmImport(confirmRows)
      onDone(result)
    } catch {
      setError('Import failed. Please try again.')
      setConfirming(false)
    }
  }

  const importCount = previewResult.rows.filter((r, _) => {
    if (r.status === 'new') return true
    return decisions[r.index] === 'overwrite'
  }).length

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-green-600 font-medium">{previewResult.totalNew} new</span>
        {previewResult.totalDuplicates > 0 && (
          <span className="text-yellow-600 font-medium">{previewResult.totalDuplicates} duplicates</span>
        )}
        {totalWarnings > 0 && (
          <span className="text-orange-500 font-medium">{totalWarnings} warnings</span>
        )}
      </div>

      {/* Row table */}
      <div className="border rounded-lg overflow-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium">Company</th>
              <th className="text-left px-3 py-2 font-medium">Stage</th>
              <th className="text-left px-3 py-2 font-medium">Revenue</th>
              <th className="text-left px-3 py-2 font-medium">Owner</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {previewResult.rows.map((row) => (
              <RowEntry
                key={row.index}
                row={row}
                decision={decisions[row.index]}
                onDecision={(d) => setDecisions(prev => ({ ...prev, [row.index]: d }))}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={confirming}>← Back</Button>
        <Button
          disabled={unresolvedCount > 0 || confirming}
          onClick={handleConfirm}
        >
          {confirming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {unresolvedCount > 0
            ? `Resolve ${unresolvedCount} duplicate${unresolvedCount > 1 ? 's' : ''} first`
            : `Import ${importCount} Lead${importCount !== 1 ? 's' : ''}`
          }
        </Button>
      </div>
    </div>
  )
}

function RowEntry({
  row,
  decision,
  onDecision,
}: {
  row: PreviewRow;
  decision: DuplicateAction | undefined;
  onDecision: (d: DuplicateAction) => void;
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className={`border-t ${row.status === 'duplicate' ? 'bg-yellow-50/50' : ''} ${row.warnings.length > 0 ? 'bg-orange-50/30' : ''}`}
      >
        <td className="px-3 py-2 text-muted-foreground">{row.index + 1}</td>
        <td className="px-3 py-2 font-medium">{row.parsed.companyName}</td>
        <td className="px-3 py-2 text-xs">{row.parsed.salesStage}</td>
        <td className="px-3 py-2 text-xs">{row.parsed.estimatedRevenue > 0 ? row.parsed.estimatedRevenue.toLocaleString() : '—'}</td>
        <td className="px-3 py-2 text-xs">{row.parsed.ownerEmail}</td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {row.status === 'new' && <Badge className="bg-green-100 text-green-700 border-0 text-xs">New</Badge>}
            {row.status === 'duplicate' && (
              <button
                className="text-xs text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full hover:bg-yellow-200"
                onClick={() => setExpanded(e => !e)}
              >
                {decision === 'overwrite' ? '🔄 Overwrite' : decision === 'skip' ? '⏭ Skip' : '⚠ Duplicate'}
              </button>
            )}
            {row.warnings.length > 0 && (
              <span className="text-xs text-orange-600" title={row.warnings.join('\n')}>⚠ {row.warnings.length}</span>
            )}
          </div>
        </td>
      </tr>
      {expanded && row.existingLead && (
        <tr className="bg-yellow-50/80 border-t border-yellow-100">
          <td colSpan={6} className="px-4 py-3">
            <div className="text-xs space-y-2">
              <p className="font-medium text-yellow-800">Existing lead: {row.existingLead.companyName} · {row.existingLead.salesStage} · {row.existingLead.ownerEmail}</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`dup-${row.index}`}
                    checked={decision === 'skip'}
                    onChange={() => onDecision('skip')}
                  />
                  <span>Skip — keep existing lead</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`dup-${row.index}`}
                    checked={decision === 'overwrite'}
                    onChange={() => onDecision('overwrite')}
                  />
                  <span>Overwrite — update with spreadsheet values</span>
                </label>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors (Step3 still missing — only that import error expected).

---

## Task 9: Frontend — Step 3 Result

**Files:**
- Create: `frontend/src/components/leads/ImportStep3Result.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/leads/ImportStep3Result.tsx`:

```tsx
import { CheckCircle, RefreshCw, SkipForward, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import type { ImportResult } from '@/lib/api/importApi'

interface Props {
  result: ImportResult;
  onDone: () => void;
}

export function ImportStep3Result({ result, onDone }: Props) {
  const [showErrors, setShowErrors] = useState(false)
  const hasErrors = result.errors.length > 0

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
        <h3 className="text-lg font-semibold">Import Complete</h3>
      </div>

      <div className="flex justify-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-green-600">{result.created}</span>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <CheckCircle className="h-3.5 w-3.5" />
            Created
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-blue-600">{result.updated}</span>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Updated
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-muted-foreground">{result.skipped}</span>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <SkipForward className="h-3.5 w-3.5" />
            Skipped
          </div>
        </div>
        {hasErrors && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-destructive">{result.errors.length}</span>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              Errors
            </div>
          </div>
        )}
      </div>

      {hasErrors && (
        <div className="border border-destructive/30 rounded-md overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-2 bg-destructive/5 text-sm font-medium text-destructive hover:bg-destructive/10"
            onClick={() => setShowErrors(e => !e)}
          >
            <span>{result.errors.length} row{result.errors.length > 1 ? 's' : ''} had errors</span>
            {showErrors ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showErrors && (
            <ul className="divide-y text-xs">
              {result.errors.map((e) => (
                <li key={e.row} className="px-4 py-2">
                  <span className="text-muted-foreground">Row {e.row + 1}:</span> {e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors.

---

## Task 10: Frontend — Wire into LeadsPage

**Files:**
- Modify: `frontend/src/pages/shared/LeadsPage.tsx`

- [ ] **Step 1: Add import to LeadsPage.tsx**

Open `frontend/src/pages/shared/LeadsPage.tsx`.

Add to the import block at the top:

```tsx
import { Upload } from 'lucide-react'
import { ImportLeadsModal } from '@/components/leads/ImportLeadsModal'
```

- [ ] **Step 2: Add state for modal**

Inside the `LeadsPage` function, after the existing `useState` declarations, add:

```tsx
const [importOpen, setImportOpen] = useState(false)
```

- [ ] **Step 3: Add Import button and modal to the JSX**

Find the section in the JSX where the "Add Lead" button is rendered (look for the `Plus` icon button or `showNewLeadForm` state). Add the Import button immediately before it, wrapped in the admin check:

```tsx
{isAdmin && (
  <Button variant="outline" onClick={() => setImportOpen(true)}>
    <Upload className="h-4 w-4 mr-2" />
    Import
  </Button>
)}
```

After the existing modal/sheet components (after `<DealModal ... />` or wherever the JSX ends before the closing fragment), add:

```tsx
<ImportLeadsModal
  open={importOpen}
  onClose={() => setImportOpen(false)}
  onComplete={() => {
    setImportOpen(false)
  }}
/>
```

- [ ] **Step 4: TypeScript check**

```bash
cd "d:/Project/Sale Funnel/frontend"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Verify the Import button appears for admin**

Start the dev server:

```bash
cd "d:/Project/Sale Funnel/backend" && npm run dev
# In another terminal:
cd "d:/Project/Sale Funnel/frontend" && npm run dev
```

Open `http://localhost:3000`, log in as admin, go to Leads page.
Expected: "Import" button visible next to "Add Lead". Not visible when logged in as a sales user.

- [ ] **Step 6: Verify Step 1 works**

Click "Import". Modal opens with step indicator showing Step 1 active.
Drag a CSV file onto the drop zone. Expected: row count shown, columns listed in mapping table with auto-mapped values pre-selected.
Verify "Preview Import →" button is disabled until Company Name is mapped.

- [ ] **Step 7: Verify Step 2 works**

With a file loaded and Company Name mapped, click "Preview Import →".
Expected: loading spinner, then table of rows with 🟢 New / 🟡 Duplicate badges.
Click a duplicate row's badge — expected: expand to show existing lead + Skip/Overwrite radio buttons.
Verify "Import N Leads" button is disabled until all duplicates have a decision.

- [ ] **Step 8: Verify Step 3 works**

Select Skip or Overwrite for each duplicate, click "Import N Leads".
Expected: Step 3 summary showing Created / Updated / Skipped counts.
Click "Done" — modal closes, Leads page shows the newly imported leads.

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| 3-step wizard modal | Task 6 (modal shell) |
| File parsing CSV/XLSX | Task 5 (importParser) |
| Auto-map with manual override | Task 5 + Task 7 (Step1) |
| Max 1,000 rows / 5 MB | Task 7 (Step1), Task 2 (controller) |
| POST /api/leads/import/preview | Task 2 + Task 3 |
| POST /api/leads/import/confirm | Task 2 + Task 3 |
| Duplicate detection per row | Task 2 |
| Skip / Overwrite per duplicate | Task 8 (Step2) |
| Owner email resolution + fallback | Task 2 |
| Stage/solution validation + warnings | Task 2 |
| Single contact per row | Task 2 + Task 4 (importApi) |
| Result summary + row errors | Task 9 (Step3) |
| Admin-only (requireAdmin) | Task 3 (routes) |
| Import button admin-only | Task 10 |
| Leads list refreshes after import | Task 10 (onComplete) |
