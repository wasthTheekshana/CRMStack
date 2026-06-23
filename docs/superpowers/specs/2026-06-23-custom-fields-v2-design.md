# Custom Fields V2 — Fully Customizable Lead Fields

**Date:** 2026-06-23
**Branch:** `feature/custom-fields-v2`
**Status:** Design approved, pending implementation

## Overview

Migrate all hardcoded lead fields (image_count, box_count, remarks, ho_update) into a unified custom field system. Add formula fields for calculations (e.g., invoice tracking) and configurable dashboard widgets for custom field analytics.

Core constraints:
- Zero data loss for existing tenants
- Tenant data is fully isolated — no cross-tenant operations
- `estimated_revenue` and `probability` remain as core DB columns (they power pipeline math)
- Old DB columns kept as rollback safety net, app stops reading them

## 1. Unified Field System

### 1.1 Field Configuration

All fields (including migrated standard fields) are defined in `tenant_configs.custom_fields` JSONB:

```typescript
interface FieldConfig {
  id: string              // "cf_<timestamp>" for new, "std_image_count" etc. for migrated
  name: string            // Display name
  type: 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'formula'
  required: boolean
  options?: string[]      // For select type
  group?: string          // Group ID this field belongs to
  order: number           // Sort order within its group
  formula?: string        // For formula type: "{{cf_qty}} * {{cf_unit_price}}"
  precision?: number      // Decimal places for number/formula (default 2)
  prefix?: string         // Display prefix, e.g., "$", "Rs."
  suffix?: string         // Display suffix, e.g., "%", "units"
}
```

### 1.2 Field Groups

New `field_groups` JSONB array in `tenant_configs`:

```typescript
interface FieldGroup {
  id: string              // "grp_<timestamp>"
  name: string            // "Invoice Details", "Shipping Info"
  order: number           // Sort order of the group
  collapsed?: boolean     // Default collapsed state on forms
}
```

Fields without a `group` belong to a default "General" group.

### 1.3 Lead Storage

All field values live in `leads.custom_fields` JSONB (existing column, no schema change):

```json
{
  "std_image_count": 5,
  "std_box_count": 12,
  "std_remarks": "Follow up next week",
  "std_ho_update": "Approved by HO",
  "cf_unit_price": 150.00,
  "cf_qty": 10,
  "cf_total": 1500.00
}
```

### 1.4 Core Fields (Not Migrated)

These remain as real DB columns — they're fundamental to CRM pipeline math:
- `estimated_revenue` (NUMERIC 15,2) — used in KPI weighted revenue calculations
- `probability` (INTEGER 0-100) — used in stage-based pipeline projections
- `company_name`, `solution`, `sales_stage` — structural fields for Kanban/pipeline

## 2. Formula Engine

### 2.1 Syntax

Expressions reference other fields using `{{field_id}}`:

```
{{cf_qty}} * {{cf_unit_price}}
({{cf_qty}} * {{cf_unit_price}}) - {{cf_discount}}
{{cf_subtotal}} * (1 + {{cf_tax_rate}} / 100)
ROUND({{cf_total}} * 0.18, 2)
```

### 2.2 Supported Operations

| Type | Supported |
|------|-----------|
| Arithmetic | `+`, `-`, `*`, `/` |
| Grouping | `( )` |
| Functions | `ROUND(expr, decimals)`, `MIN(a, b)`, `MAX(a, b)`, `ABS(expr)` |

No conditionals (`IF`), no string operations. Referenced fields that are null default to `0`.

### 2.3 Evaluation Rules

- **Computed on write** — formula results are calculated server-side when a lead is created or updated, then stored in `custom_fields` JSONB
- **Topological ordering** — if `cf_total` depends on `cf_subtotal` which depends on `cf_qty`, formulas are evaluated in dependency order
- **Circular reference detection** — when an admin saves field config, the backend builds a dependency graph and rejects cycles with a clear error message
- **Cascade re-evaluation** — when any source field value changes, all dependent formula fields are recalculated in the same request

### 2.4 Parser Implementation

A lightweight recursive-descent parser in TypeScript (~150-200 lines):
1. Tokenizer: splits expression into numbers, operators, parentheses, function names, field references
2. AST builder: recursive descent parsing respecting operator precedence
3. Evaluator: walks the AST, resolves `{{field_id}}` from the lead's custom_fields values

No `eval()`, no third-party formula libraries. Safe by construction.

### 2.5 Admin UX

When field type is "formula" in the settings UI:
- Text input for the expression
- Dropdown/chip picker listing available numeric and formula fields — clicking inserts `{{field_id}}`
- Live preview panel: shows result with sample values
- Validation: immediate feedback for syntax errors, unknown fields, or circular references

## 3. Dashboard Analytics Widgets

### 3.1 Widget Configuration

New `dashboard_widgets` JSONB array in `tenant_configs`:

```typescript
interface DashboardWidget {
  id: string                // "wgt_<timestamp>"
  name: string              // "Total Revenue by Product"
  type: 'sum' | 'average' | 'count' | 'min' | 'max' | 'group_by'
  field_id: string          // Custom field to aggregate (must be numeric or formula)
  group_by_field?: string   // For group_by: a select, stage, or solution field
  chart_type: 'number' | 'bar' | 'pie' | 'table'
  order: number             // Position on dashboard
  role: 'admin' | 'sales' | 'both'
}
```

### 3.2 Widget Templates

| Template | What Admin Configures | Output |
|----------|----------------------|--------|
| **KPI Card** | Numeric field + aggregation (sum/avg/min/max) | Single number card, e.g., "Total Invoice: $45,200" |
| **Grouped Bar Chart** | Numeric field + group-by select/stage field | Bar chart with categories |
| **Pie Chart** | Count or sum + group-by select field | Pie chart with slices |
| **Summary Table** | Numeric field + group-by field | Table: Group / Count / Total / Average |

### 3.3 Backend API

New endpoint: `GET /api/kpi/custom-widgets`

Returns computed data for all configured widgets. Uses PostgreSQL JSONB operators:

```sql
SELECT
  custom_fields->>$group_field AS group_key,
  SUM((custom_fields->>$value_field)::numeric) AS total,
  AVG((custom_fields->>$value_field)::numeric) AS average,
  COUNT(*) AS count
FROM leads
WHERE tenant_id = $1 AND is_deleted = false
GROUP BY custom_fields->>$group_field
```

Each widget's query is parameterized based on its config — no dynamic SQL injection risk.

### 3.4 Dashboard Rendering

- Existing KPI widgets (pipeline stats, weighted revenue, by-stage, by-solution) remain unchanged
- Custom widgets render in a new "Custom Analytics" section below existing widgets
- Uses Recharts (already in the project) for bar/pie charts
- KPI cards are simple number displays with prefix/suffix formatting

## 4. Migration Strategy

### 4.1 Migration Script (new SQL migration)

**Step 1 — Create field definitions per tenant:**

For each tenant, based on their `visible_fields` config:
- `imageCount !== false` → `{ id: "std_image_count", name: "Image Count", type: "number", group: "grp_general", order: 1 }`
- `boxCount !== false` → `{ id: "std_box_count", name: "Box Count", type: "number", group: "grp_general", order: 2 }`
- `remarks !== false` → `{ id: "std_remarks", name: "Remarks", type: "text", group: "grp_general", order: 3 }`
- `hoUpdate !== false` → `{ id: "std_ho_update", name: "HO Update", type: "text", group: "grp_general", order: 4 }`

Appended to each tenant's existing `custom_fields` array. A default "General" group is created in `field_groups`.

Existing custom fields that tenants already have are preserved — new definitions are appended after them.

**Step 2 — Copy lead data into JSONB:**

```sql
UPDATE leads SET custom_fields = custom_fields || jsonb_build_object(
  'std_image_count', image_count,
  'std_box_count', box_count,
  'std_remarks', remarks,
  'std_ho_update', ho_update
)
WHERE tenant_id = $tenant_id;
```

Runs per-tenant with `WHERE tenant_id` — complete data isolation.

**Step 3 — Clean up tenant config:**

Replace `visible_fields` with a simpler `core_field_visibility` object that only controls the remaining core fields:

```typescript
interface CoreFieldVisibility {
  probability?: boolean  // default true
}
```

Custom field visibility is controlled by whether the field definition exists in the tenant's `custom_fields` array. The old `visible_fields` object is removed.

**Step 4 — Do NOT drop old columns:**

Columns `image_count`, `box_count`, `remarks`, `ho_update` stay in the `leads` table. The app stops reading/writing them. They serve as a rollback safety net.

### 4.2 API Backward Compatibility

During a transition period, the API accepts both formats:
- Old: `{ imageCount: 5, boxCount: 12, remarks: "..." }`
- New: `{ customFields: { std_image_count: 5, std_box_count: 12, std_remarks: "..." } }`

GET responses return values from `customFields` only. Old top-level fields are omitted.

### 4.3 Rollback Plan

If anything goes wrong:
1. Old columns still contain original data (never deleted)
2. Revert app code to read from columns again
3. Remove migrated field definitions from tenant config
4. No data is lost at any point

## 5. Settings UI Changes

### 5.1 Workspace Settings Tabs

| Tab | Status |
|-----|--------|
| Pipeline | No change |
| Products | No change |
| Lead Fields | Redesigned — full field manager with groups, formulas, formatting |
| Branding | No change |
| **Dashboard Widgets** | New tab |

### 5.2 Lead Fields Tab (Redesigned)

- **Group management panel** — add, rename, reorder, delete groups (drag & drop)
- **Field list per group** — drag fields between groups, reorder within a group
- **Field editor** (click to expand):
  - Name, type, required toggle
  - For number: precision, prefix, suffix
  - For select: options list management
  - For formula: expression builder with field picker + live preview + validation
- Migrated standard fields appear as normal custom fields — can be renamed, moved between groups, or deleted by the tenant

### 5.3 Dashboard Widgets Tab (New)

- Widget list showing name, type, target field, chart type
- "Add Widget" button → template picker (KPI Card, Bar Chart, Pie Chart, Summary Table)
- Widget editor: name, aggregation type, target field (dropdown of numeric/formula fields), group-by field (dropdown of select fields), chart type, role (admin/sales/both)
- Drag-and-drop reorder
- Preview button to see widget with live data

### 5.4 LeadForm Changes

- All fields rendered dynamically from tenant config — no hardcoded field rendering
- Fields organized by groups, each group is a collapsible section
- Formula fields displayed as read-only computed values (greyed background, auto-calculated label)
- Core fields (company name, solution, sales stage, estimated revenue, probability, contacts) remain at the top, outside of custom field groups

## 6. Files to Modify

### Backend
- `backend/migrations/` — new migration for data migration + `field_groups` + `dashboard_widgets`
- `backend/src/models/tenantConfigModel.ts` — updated types, new `FieldGroup` and `DashboardWidget` interfaces
- `backend/src/models/leadModel.ts` — stop reading old columns, read/write from `custom_fields` only
- `backend/src/controllers/leadController.ts` — formula evaluation on create/update, backward-compat mapping
- `backend/src/controllers/tenantConfigController.ts` — validate formula fields (circular refs), validate widget configs
- `backend/src/controllers/kpiController.ts` — new custom widget aggregation endpoint
- `backend/src/routes/` — new route for custom widget KPIs
- New file: `backend/src/utils/formulaEngine.ts` — tokenizer, parser, evaluator

### Frontend
- `frontend/src/models/index.ts` — updated types
- `frontend/src/services/tenantService.ts` — updated config types
- `frontend/src/store/tenantStore.ts` — new selectors for field groups, dashboard widgets
- `frontend/src/components/leads/LeadForm.tsx` — dynamic grouped rendering, formula display
- `frontend/src/components/settings/LeadFieldSettings.tsx` — redesigned with groups, formula editor
- New file: `frontend/src/components/settings/DashboardWidgetSettings.tsx` — widget config UI
- New file: `frontend/src/components/dashboard/CustomWidgets.tsx` — widget rendering components
- `frontend/src/pages/admin/WorkspaceSettings.tsx` — add Dashboard Widgets tab
- `frontend/src/pages/admin/AdminDashboard.tsx` — render custom widgets section
- `frontend/src/pages/sales/SalesDashboard.tsx` — render custom widgets section (role-filtered)
- `frontend/src/services/kpiService.ts` — new API call for custom widget data

## 7. Testing Strategy

- **Migration**: Run on a copy of production data, verify all field values match between old columns and new JSONB entries
- **Formula engine**: Unit tests for parser (valid expressions, operator precedence, nested parentheses, function calls, circular detection, null handling)
- **API compatibility**: Test that old-format requests still work during transition
- **Dashboard widgets**: Verify aggregation queries return correct results against known test data
- **Multi-tenant isolation**: Verify that tenant A's field config and widget config do not affect tenant B
