# Group 1 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete three partially-built features — custom fields in the lead creation form, tenant branding on the login page, and PDF exports using tenant branding instead of hardcoded strings.

**Architecture:** No new endpoints or tables needed for Features 2 and 4. Feature 3 (login branding) requires one new public backend route since the tenant config endpoint requires auth. All changes are narrow — existing patterns are extended, not redesigned.

**Tech Stack:** React 18 + TypeScript + Vite (frontend), Express + PostgreSQL (backend), existing `useBranding`, `useCustomFields`, `useVisibleFields` hooks from tenantStore.

> **Note on Feature 1 (Sales Dashboard):** Already fully implemented — skip.

---

## File Map

**Feature 2 — Custom Fields in LeadForm**
- Modify: `frontend/src/components/leads/LeadForm.tsx`

**Feature 3 — Tenant Branding on Login**
- Create: `backend/src/routes/publicBranding.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `frontend/src/pages/auth/LoginPage.tsx`

**Feature 4 — PDF Export Branding**
- Modify: `frontend/src/utils/exporters.ts`
- Modify: `frontend/src/pages/shared/ReportsPage.tsx` (find exporters call sites)

---

## Task 1: Custom Fields in LeadForm

The `DealModal` already renders custom fields (lines 598–670 of `DealModal.tsx`). Copy the same pattern into `LeadForm.tsx`. The key additions are:

1. Import `useCustomFields`, `useVisibleFields`, `CustomFieldConfig` from tenantStore and types
2. Add `customFieldValues` state (`Record<string, string>`)
3. Guard existing static fields with `visibleFields` checks (imageCount, boxCount, remarks, hoUpdate, probability — DealModal already shows how)
4. Append the custom fields rendering block before `DialogFooter`
5. Include `customFields: customFieldValues` in the `onSave(...)` call

**Files:**
- Modify: `frontend/src/components/leads/LeadForm.tsx`

- [ ] **Step 1: Add imports**

Open `frontend/src/components/leads/LeadForm.tsx`. Change line 28–29 from:

```typescript
import { LeadFormData, SalesStage, Contact } from '@/types'
import { useSalesStages, useSolutions, useDefaultProbability } from '@/store/tenantStore'
```

to:

```typescript
import { LeadFormData, SalesStage, Contact } from '@/types'
import { CustomFieldConfig } from '@/types'
import { useSalesStages, useSolutions, useDefaultProbability, useCustomFields, useVisibleFields } from '@/store/tenantStore'
```

> **Note:** If `CustomFieldConfig` lives in a different path (check `@/types` or `@/models`), adjust the import. Run `grep -r "CustomFieldConfig" frontend/src` to find it.

- [ ] **Step 2: Add hooks + state**

Inside the `LeadForm` component function, after the existing hook calls (line 57–58), add:

```typescript
const customFields   = useCustomFields()
const visibleFields  = useVisibleFields()
const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
```

- [ ] **Step 3: Guard static optional fields with visibleFields**

Wrap the `imageCount`, `boxCount`, `remarks`, and `hoUpdate` inputs so they hide when the admin has toggled them off. Also wrap the `probability` slider.

Find the `<div className="space-y-2">` that contains `imageCount` input (around line 364) and wrap it:

```tsx
{visibleFields['imageCount'] !== false && (
  <div className="space-y-2">
    <Label htmlFor="imageCount">Image Count</Label>
    <Input
      id="imageCount"
      type="number"
      {...register('imageCount')}
      disabled={isLoading}
      placeholder="0"
    />
  </div>
)}
```

Do the same for `boxCount`:

```tsx
{visibleFields['boxCount'] !== false && (
  <div className="space-y-2">
    <Label htmlFor="boxCount">Box Count</Label>
    <Input
      id="boxCount"
      type="number"
      {...register('boxCount')}
      disabled={isLoading}
      placeholder="0"
    />
  </div>
)}
```

Wrap `probability` slider:

```tsx
{visibleFields['probability'] !== false && (
  <div className="space-y-2 col-span-2">
    <div className="flex items-center justify-between">
      <Label>Probability</Label>
      <span className="text-sm font-medium">{probability}%</span>
    </div>
    <Slider
      value={[probability || 0]}
      onValueChange={([value]) => setValue('probability', value)}
      max={100}
      step={5}
      disabled={isLoading}
    />
  </div>
)}
```

Wrap `remarks`:

```tsx
{visibleFields['remarks'] !== false && (
  <div className="space-y-2 col-span-2">
    <Label htmlFor="remarks">Remarks</Label>
    <Textarea
      id="remarks"
      {...register('remarks')}
      disabled={isLoading}
      rows={3}
      maxLength={5000}
      placeholder="Enter any additional notes..."
    />
  </div>
)}
```

Wrap `hoUpdate`:

```tsx
{visibleFields['hoUpdate'] !== false && (
  <div className="space-y-2 col-span-2">
    <Label htmlFor="hoUpdate">H/O Update</Label>
    <Input
      id="hoUpdate"
      {...register('hoUpdate')}
      disabled={isLoading}
      maxLength={5000}
      placeholder="Head Office update status"
    />
  </div>
)}
```

- [ ] **Step 4: Add custom fields rendering section**

Add this block AFTER the closing `</div>` of the `grid grid-cols-2 gap-4` section that contains the static fields, and BEFORE `<DialogFooter>`:

```tsx
{/* Custom fields configured in Workspace Settings → Lead Fields */}
{customFields.length > 0 && (
  <div className="space-y-3">
    <Label className="text-base font-semibold">Custom Fields</Label>
    <div className="grid grid-cols-2 gap-4">
      {customFields.map((cf: CustomFieldConfig) => (
        <div key={cf.id} className={cn('space-y-2', cf.type === 'text' && 'col-span-2')}>
          <Label htmlFor={`cf_${cf.id}`}>
            {cf.name}
            {cf.required && <span className="text-destructive ml-1">*</span>}
          </Label>

          {cf.type === 'text' && (
            <Input
              id={`cf_${cf.id}`}
              value={customFieldValues[cf.id] ?? ''}
              onChange={e => setCustomFieldValues(p => ({ ...p, [cf.id]: e.target.value }))}
              disabled={isLoading}
            />
          )}

          {cf.type === 'number' && (
            <Input
              id={`cf_${cf.id}`}
              type="number"
              value={customFieldValues[cf.id] ?? ''}
              onChange={e => setCustomFieldValues(p => ({ ...p, [cf.id]: e.target.value }))}
              disabled={isLoading}
            />
          )}

          {cf.type === 'date' && (
            <Input
              id={`cf_${cf.id}`}
              type="date"
              value={customFieldValues[cf.id] ?? ''}
              onChange={e => setCustomFieldValues(p => ({ ...p, [cf.id]: e.target.value }))}
              disabled={isLoading}
            />
          )}

          {cf.type === 'select' && (
            <Select
              value={customFieldValues[cf.id] ?? ''}
              onValueChange={val => setCustomFieldValues(p => ({ ...p, [cf.id]: val }))}
              disabled={isLoading}
            >
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {cf.options.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {cf.type === 'checkbox' && (
            <div className="flex items-center gap-2 h-10">
              <input
                id={`cf_${cf.id}`}
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                checked={customFieldValues[cf.id] === 'true'}
                onChange={e => setCustomFieldValues(p => ({ ...p, [cf.id]: String(e.target.checked) }))}
                disabled={isLoading}
              />
              <label htmlFor={`cf_${cf.id}`} className="text-sm text-muted-foreground">
                {cf.name}
              </label>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Add required field validation + pass customFields on submit**

In the `onSubmit` function, after the existing `hasValidContact` check and before `setIsLoading(true)`, add:

```typescript
// Validate required custom fields
for (const cf of customFields) {
  if (cf.required && !customFieldValues[cf.id]?.trim()) {
    toast.error(`"${cf.name}" is required`)
    return
  }
}
```

Then in the `onSave(...)` call, add `customFields: customFieldValues`:

```typescript
await onSave({
  ...data,
  contacts: validContacts,
  salesStage: data.salesStage as SalesStage,
  customFields: customFieldValues,
})
```

- [ ] **Step 6: Reset custom fields on close**

In `handleClose`, add the reset:

```typescript
const handleClose = () => {
  reset()
  setContacts([{ id: generateContactId(), name: '', phone: '', email: '', designation: '', isPrimary: true }])
  setCustomFieldValues({})
  setContactError(null)
  onClose()
}
```

Also reset in `onSubmit` after `reset()`:
```typescript
reset()
setCustomFieldValues({})
setContacts([...])
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual test**

1. Open the app and go to Workspace Settings → Lead Fields
2. Add a custom field named "Budget Range" of type `select` with options `Small, Medium, Large`; mark required
3. Click "Create Lead" somewhere in the app
4. Confirm "Budget Range" appears in the form with a dropdown
5. Try to submit without filling it — confirm error toast "Budget Range is required"
6. Fill it in and submit — confirm lead is created successfully

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/leads/LeadForm.tsx
git commit -m "feat(leads): render custom fields in lead creation form"
```

---

## Task 2: Tenant Branding on Login Page

The login page renders before authentication, so `useBranding()` (which reads from tenantStore, populated post-login) is not available. Solution: add a public backend route that returns branding for the current subdomain, then fetch it on mount in `LoginPage`.

Nginx already injects `X-Tenant-Subdomain` for every request, so the backend can use that to look up the tenant config without any auth.

**Files:**
- Create: `backend/src/routes/publicBranding.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `frontend/src/pages/auth/LoginPage.tsx`

- [ ] **Step 1: Create the public branding route**

```typescript
// backend/src/routes/publicBranding.ts
import { Router, Request, Response } from 'express'
import { resolveTenantOptional } from '../middleware/tenantResolver'
import { getTenantConfig } from '../models/tenantConfigModel'

const router = Router()

router.get('/', resolveTenantOptional, async (req: Request, res: Response) => {
  try {
    if (!req.tenantId) {
      res.json({ companyName: null, logoUrl: null, primaryColor: null })
      return
    }
    const config = await getTenantConfig(req.tenantId)
    const b = config?.branding ?? {}
    res.json({
      companyName:  b.companyName  ?? null,
      logoUrl:      b.logoUrl      ?? null,
      primaryColor: b.primaryColor ?? null,
    })
  } catch {
    res.json({ companyName: null, logoUrl: null, primaryColor: null })
  }
})

export default router
```

> **Check:** Verify the model export name. Look at `backend/src/models/tenantConfigModel.ts` — find the function that reads tenant config by tenant ID and use it. Common names: `getTenantConfig`, `findTenantConfig`, `getConfig`. If `resolveTenantOptional` doesn't exist in tenantResolver, check what the optional variant is named. If there's only `resolveTenant`, create a try/catch inline instead.

- [ ] **Step 2: Register the route in index.ts**

Open `backend/src/routes/index.ts`. Add at the top:

```typescript
import publicBrandingRoutes from './publicBranding';
```

Add registration BEFORE the authenticated routes (before `router.use('/auth', ...)` is fine — it's public):

```typescript
router.use('/public/branding', publicBrandingRoutes);
```

- [ ] **Step 3: Test the endpoint**

```bash
curl -H "X-Tenant-Subdomain: abanscrm" http://localhost:4000/api/public/branding
```

Expected response (values depend on what's set in the DB):
```json
{"companyName": "ABANS CRM", "logoUrl": null, "primaryColor": "#3b82f6"}
```

If tenant has no branding configured: `{"companyName": null, "logoUrl": null, "primaryColor": null}`

- [ ] **Step 4: Update LoginPage to fetch and apply branding**

Replace `frontend/src/pages/auth/LoginPage.tsx` entirely:

```tsx
// frontend/src/pages/auth/LoginPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuthStore } from '@/store/authStore'
import { hexToHsl } from '@/utils/color'

interface PublicBranding {
  companyName:  string | null
  logoUrl:      string | null
  primaryColor: string | null
}

export function LoginPage() {
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [branding, setBranding] = useState<PublicBranding>({ companyName: null, logoUrl: null, primaryColor: null })

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    void fetch('/api/public/branding')
      .then(r => r.ok ? r.json() : null)
      .then((data: PublicBranding | null) => {
        if (data) {
          setBranding(data)
          if (data.primaryColor) {
            document.documentElement.style.setProperty('--primary', hexToHsl(data.primaryColor))
          }
        }
      })
      .catch(() => {/* silently ignore — fall back to defaults */})
  }, [])

  const companyName = branding.companyName ?? 'CRM STACK'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={companyName}
                className="h-16 w-auto object-contain"
              />
            ) : (
              <img
                src="/crmstack_logo.png"
                alt={companyName}
                className="h-16 w-auto object-contain"
              />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">{companyName}</CardTitle>
          <CardDescription>
            Sign in to access your sales dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  )
}
```

> **Check:** Verify `hexToHsl` exists at `@/utils/color`. `AppLayout.tsx` already imports it from there. If the path differs, adjust the import.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
cd backend  && npx tsc --noEmit
```

- [ ] **Step 6: Manual test**

1. Set a branding config via Workspace Settings → Branding (set Company Name = "ABANS GROUP", primary color = `#dc2626`)
2. Log out
3. Reload the login page — confirm it shows "ABANS GROUP" as the title
4. Confirm the Sign In button shows in red (primary color applied)

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/publicBranding.ts \
        backend/src/routes/index.ts \
        frontend/src/pages/auth/LoginPage.tsx
git commit -m "feat(auth): apply tenant branding on login page"
```

---

## Task 3: PDF Export Uses Tenant Branding

`exporters.ts` hardcodes `'CRM STACK'` and `[59, 130, 246]` (blue). Pass branding in as parameters so exports reflect the tenant's identity.

**Files:**
- Modify: `frontend/src/utils/exporters.ts`
- Modify: `frontend/src/pages/shared/ReportsPage.tsx`

- [ ] **Step 1: Add a branding parameter to all PDF export functions**

Open `frontend/src/utils/exporters.ts`.

Change `exportToPDF` signature from:
```typescript
export function exportToPDF(
  leads: Lead[],
  title: string = 'Sales Report',
  filters?: { ... }
): void {
```

to:
```typescript
export function exportToPDF(
  leads: Lead[],
  title: string = 'Sales Report',
  filters?: {
    dateRange?: string
    stage?: SalesStage
    solution?: string
  },
  branding?: { companyName?: string | null; primaryColor?: string | null }
): void {
```

Inside `exportToPDF`, replace:
```typescript
doc.text('CRM STACK', 14, 20)
```
with:
```typescript
doc.text(branding?.companyName ?? 'CRM STACK', 14, 20)
```

Replace the hardcoded blue color in `headStyles`:
```typescript
headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
```
with:
```typescript
headStyles: { fillColor: hexToRgb(branding?.primaryColor ?? '#3b82f6'), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
```

Add this helper function at the TOP of `exporters.ts` (before the `exportToCSV` function):
```typescript
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [59, 130, 246]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}
```

Change `exportSummaryToPDF` signature from:
```typescript
export function exportSummaryToPDF(
  data: { ... },
  title: string = 'Sales Summary Report'
): void {
```
to:
```typescript
export function exportSummaryToPDF(
  data: {
    totalCompanies: number
    totalLeads: number
    totalRevenue: number
    weightedRevenue: number
    stageBreakdown: { stage: string; count: number; revenue: number }[]
    solutionBreakdown: { solution: string; count: number; revenue: number }[]
  },
  title: string = 'Sales Summary Report',
  branding?: { companyName?: string | null; primaryColor?: string | null }
): void {
```

Inside `exportSummaryToPDF`, replace the two `'CRM STACK'` occurrences with `branding?.companyName ?? 'CRM STACK'`.

Replace both `headStyles: { fillColor: [59, 130, 246]` with `headStyles: { fillColor: hexToRgb(branding?.primaryColor ?? '#3b82f6')`.

The `fillColor: [34, 197, 94]` (green for solutions table) can stay as-is — it's intentionally different.

- [ ] **Step 2: Update ReportsPage to pass branding to export functions**

Open `frontend/src/pages/shared/ReportsPage.tsx`. Find where `exportToPDF` and/or `exportSummaryToPDF` are called.

Add the branding import at the top:
```typescript
import { useBranding } from '@/store/tenantStore'
```

Add the hook inside the component:
```typescript
const branding = useBranding()
```

Update each `exportToPDF(...)` call to pass branding as the last argument:
```typescript
exportToPDF(leads, title, filters, branding)
```

Update each `exportSummaryToPDF(...)` call:
```typescript
exportSummaryToPDF(data, title, branding)
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual test**

1. In Workspace Settings → Branding, set Company Name = "TEST CORP" and primary color = `#dc2626`
2. Go to Reports and click Export PDF
3. Open the PDF — confirm the header says "TEST CORP" and the table header row is red

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/exporters.ts \
        frontend/src/pages/shared/ReportsPage.tsx
git commit -m "feat(reports): use tenant branding in PDF exports"
```

---

## Task 4: Push

- [ ] **Step 1: Verify TypeScript across entire frontend + backend**

```bash
cd frontend && npx tsc --noEmit
cd backend  && npx tsc --noEmit
```

Expected: no errors in either.

- [ ] **Step 2: Push**

```bash
git push origin main
```
