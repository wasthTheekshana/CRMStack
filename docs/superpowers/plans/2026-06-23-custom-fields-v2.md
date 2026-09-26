# Custom Fields V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate hardcoded lead fields into a unified custom field system with formula calculations and configurable dashboard analytics widgets.

**Architecture:** All lead fields (except core pipeline fields) become tenant-configured custom fields stored in JSONB. A server-side formula engine evaluates expressions on write. Dashboard widgets are tenant-configured and rendered with Recharts.

**Tech Stack:** Node/Express/TypeScript, PostgreSQL (JSONB), React/TypeScript, Zustand, Recharts, react-hook-form + zod, shadcn/ui

## Global Constraints

- Branch: `feature/custom-fields-v2`
- Zero data loss — old DB columns (`image_count`, `box_count`, `remarks`, `ho_update`) are never dropped
- `estimated_revenue` and `probability` stay as real DB columns
- All queries scoped by `tenant_id` — no cross-tenant operations
- No `eval()` — formula parser is a hand-written recursive-descent parser
- No new npm dependencies (Recharts already available)
- Existing tests must continue to pass

---

### Task 1: Formula Engine (Backend Utility)

**Files:**
- Create: `backend/src/utils/formulaEngine.ts`
- Test: `backend/src/__tests__/formulaEngine.test.ts`

**Interfaces:**
- Consumes: nothing (standalone utility)
- Produces:
  - `tokenize(expr: string): Token[]`
  - `parse(tokens: Token[]): ASTNode`
  - `evaluate(ast: ASTNode, values: Record<string, number>): number`
  - `evaluateFormula(expr: string, values: Record<string, number>): number`
  - `extractFieldRefs(expr: string): string[]`
  - `detectCircularRefs(fields: { id: string; formula?: string }[]): string[] | null`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/formulaEngine.test.ts`:

```typescript
import {
  evaluateFormula,
  extractFieldRefs,
  detectCircularRefs,
} from '../utils/formulaEngine'

describe('formulaEngine', () => {
  describe('evaluateFormula', () => {
    it('evaluates simple addition', () => {
      expect(evaluateFormula('{{a}} + {{b}}', { a: 10, b: 20 })).toBe(30)
    })

    it('evaluates multiplication', () => {
      expect(evaluateFormula('{{qty}} * {{price}}', { qty: 5, price: 100 })).toBe(500)
    })

    it('respects operator precedence', () => {
      expect(evaluateFormula('{{a}} + {{b}} * {{c}}', { a: 1, b: 2, c: 3 })).toBe(7)
    })

    it('respects parentheses', () => {
      expect(evaluateFormula('({{a}} + {{b}}) * {{c}}', { a: 1, b: 2, c: 3 })).toBe(9)
    })

    it('handles division', () => {
      expect(evaluateFormula('{{a}} / {{b}}', { a: 10, b: 4 })).toBe(2.5)
    })

    it('returns 0 for division by zero', () => {
      expect(evaluateFormula('{{a}} / {{b}}', { a: 10, b: 0 })).toBe(0)
    })

    it('defaults missing fields to 0', () => {
      expect(evaluateFormula('{{a}} + {{b}}', { a: 10 })).toBe(10)
    })

    it('handles nested expressions', () => {
      expect(
        evaluateFormula('({{qty}} * {{price}}) - ({{qty}} * {{price}} * {{discount}} / 100)', {
          qty: 10, price: 100, discount: 15,
        })
      ).toBe(850)
    })

    it('handles numeric literals', () => {
      expect(evaluateFormula('{{a}} * 1.18', { a: 100 })).toBeCloseTo(118)
    })

    it('handles ROUND function', () => {
      expect(evaluateFormula('ROUND({{a}} / 3, 2)', { a: 10 })).toBe(3.33)
    })

    it('handles ABS function', () => {
      expect(evaluateFormula('ABS({{a}} - {{b}})', { a: 3, b: 10 })).toBe(7)
    })

    it('handles MIN function', () => {
      expect(evaluateFormula('MIN({{a}}, {{b}})', { a: 5, b: 3 })).toBe(3)
    })

    it('handles MAX function', () => {
      expect(evaluateFormula('MAX({{a}}, {{b}})', { a: 5, b: 3 })).toBe(5)
    })

    it('throws on invalid syntax', () => {
      expect(() => evaluateFormula('{{a}} +', { a: 1 })).toThrow()
    })

    it('throws on unknown function', () => {
      expect(() => evaluateFormula('SQRT({{a}})', { a: 4 })).toThrow()
    })
  })

  describe('extractFieldRefs', () => {
    it('extracts field references', () => {
      expect(extractFieldRefs('{{cf_qty}} * {{cf_price}}')).toEqual(['cf_qty', 'cf_price'])
    })

    it('returns empty array for no refs', () => {
      expect(extractFieldRefs('42 + 10')).toEqual([])
    })

    it('deduplicates refs', () => {
      expect(extractFieldRefs('{{a}} + {{a}}')).toEqual(['a'])
    })
  })

  describe('detectCircularRefs', () => {
    it('returns null for no cycles', () => {
      expect(detectCircularRefs([
        { id: 'a', formula: '{{b}} + 1' },
        { id: 'b' },
      ])).toBeNull()
    })

    it('detects direct cycle', () => {
      const result = detectCircularRefs([
        { id: 'a', formula: '{{b}} + 1' },
        { id: 'b', formula: '{{a}} + 1' },
      ])
      expect(result).not.toBeNull()
    })

    it('detects indirect cycle', () => {
      const result = detectCircularRefs([
        { id: 'a', formula: '{{b}} + 1' },
        { id: 'b', formula: '{{c}} + 1' },
        { id: 'c', formula: '{{a}} + 1' },
      ])
      expect(result).not.toBeNull()
    })

    it('detects self-reference', () => {
      const result = detectCircularRefs([
        { id: 'a', formula: '{{a}} + 1' },
      ])
      expect(result).not.toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/__tests__/formulaEngine.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the formula engine**

Create `backend/src/utils/formulaEngine.ts`:

```typescript
type TokenType = 'NUMBER' | 'FIELD_REF' | 'OP' | 'LPAREN' | 'RPAREN' | 'FUNC' | 'COMMA'

interface Token {
  type: TokenType
  value: string
}

interface ASTNode {
  type: 'number' | 'field_ref' | 'binary_op' | 'unary_neg' | 'func_call'
  value?: string | number
  op?: string
  left?: ASTNode
  right?: ASTNode
  args?: ASTNode[]
  name?: string
}

const FUNCTIONS = new Set(['ROUND', 'MIN', 'MAX', 'ABS'])

export function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue }

    if (expr[i] === '{' && expr[i + 1] === '{') {
      const end = expr.indexOf('}}', i + 2)
      if (end === -1) throw new Error('Unclosed field reference')
      tokens.push({ type: 'FIELD_REF', value: expr.slice(i + 2, end).trim() })
      i = end + 2
      continue
    }

    if (/[0-9.]/.test(expr[i])) {
      let num = ''
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++ }
      tokens.push({ type: 'NUMBER', value: num })
      continue
    }

    if (/[A-Z]/.test(expr[i])) {
      let name = ''
      while (i < expr.length && /[A-Z_]/.test(expr[i])) { name += expr[i]; i++ }
      if (!FUNCTIONS.has(name)) throw new Error(`Unknown function: ${name}`)
      tokens.push({ type: 'FUNC', value: name })
      continue
    }

    if ('+-*/'.includes(expr[i])) {
      tokens.push({ type: 'OP', value: expr[i] })
      i++; continue
    }

    if (expr[i] === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue }
    if (expr[i] === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue }
    if (expr[i] === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue }

    throw new Error(`Unexpected character: ${expr[i]}`)
  }
  return tokens
}

export function parse(tokens: Token[]): ASTNode {
  let pos = 0

  function peek(): Token | undefined { return tokens[pos] }
  function consume(): Token { return tokens[pos++] }

  function parseExpr(): ASTNode {
    let left = parseTerm()
    while (peek()?.type === 'OP' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume().value
      const right = parseTerm()
      left = { type: 'binary_op', op, left, right }
    }
    return left
  }

  function parseTerm(): ASTNode {
    let left = parseUnary()
    while (peek()?.type === 'OP' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = consume().value
      const right = parseUnary()
      left = { type: 'binary_op', op, left, right }
    }
    return left
  }

  function parseUnary(): ASTNode {
    if (peek()?.type === 'OP' && peek()!.value === '-') {
      consume()
      const operand = parsePrimary()
      return { type: 'unary_neg', left: operand }
    }
    return parsePrimary()
  }

  function parsePrimary(): ASTNode {
    const token = peek()
    if (!token) throw new Error('Unexpected end of expression')

    if (token.type === 'NUMBER') {
      consume()
      return { type: 'number', value: parseFloat(token.value) }
    }

    if (token.type === 'FIELD_REF') {
      consume()
      return { type: 'field_ref', value: token.value }
    }

    if (token.type === 'FUNC') {
      const name = consume().value
      if (!peek() || peek()!.type !== 'LPAREN') throw new Error(`Expected ( after ${name}`)
      consume() // (
      const args: ASTNode[] = []
      if (peek()?.type !== 'RPAREN') {
        args.push(parseExpr())
        while (peek()?.type === 'COMMA') {
          consume() // ,
          args.push(parseExpr())
        }
      }
      if (!peek() || peek()!.type !== 'RPAREN') throw new Error(`Expected ) after ${name} arguments`)
      consume() // )
      return { type: 'func_call', name, args }
    }

    if (token.type === 'LPAREN') {
      consume()
      const node = parseExpr()
      if (!peek() || peek()!.type !== 'RPAREN') throw new Error('Missing closing parenthesis')
      consume()
      return node
    }

    throw new Error(`Unexpected token: ${token.value}`)
  }

  const ast = parseExpr()
  if (pos < tokens.length) throw new Error(`Unexpected token: ${tokens[pos].value}`)
  return ast
}

export function evaluate(ast: ASTNode, values: Record<string, number>): number {
  switch (ast.type) {
    case 'number':
      return ast.value as number
    case 'field_ref':
      return values[ast.value as string] ?? 0
    case 'unary_neg':
      return -evaluate(ast.left!, values)
    case 'binary_op': {
      const left = evaluate(ast.left!, values)
      const right = evaluate(ast.right!, values)
      switch (ast.op) {
        case '+': return left + right
        case '-': return left - right
        case '*': return left * right
        case '/': return right === 0 ? 0 : left / right
        default: throw new Error(`Unknown operator: ${ast.op}`)
      }
    }
    case 'func_call': {
      const args = ast.args!.map(a => evaluate(a, values))
      switch (ast.name) {
        case 'ROUND': return parseFloat(args[0].toFixed(args[1] ?? 0))
        case 'ABS':   return Math.abs(args[0])
        case 'MIN':   return Math.min(args[0], args[1])
        case 'MAX':   return Math.max(args[0], args[1])
        default: throw new Error(`Unknown function: ${ast.name}`)
      }
    }
    default:
      throw new Error(`Unknown AST node type: ${ast.type}`)
  }
}

export function evaluateFormula(expr: string, values: Record<string, number>): number {
  const tokens = tokenize(expr)
  const ast = parse(tokens)
  return evaluate(ast, values)
}

export function extractFieldRefs(expr: string): string[] {
  const refs: string[] = []
  const regex = /\{\{([^}]+)\}\}/g
  let match
  while ((match = regex.exec(expr)) !== null) {
    const ref = match[1].trim()
    if (!refs.includes(ref)) refs.push(ref)
  }
  return refs
}

export function detectCircularRefs(
  fields: { id: string; formula?: string }[]
): string[] | null {
  const graph = new Map<string, string[]>()
  for (const f of fields) {
    if (f.formula) {
      graph.set(f.id, extractFieldRefs(f.formula))
    }
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()
  const cycle: string[] = []

  function dfs(node: string): boolean {
    if (inStack.has(node)) {
      cycle.push(node)
      return true
    }
    if (visited.has(node)) return false
    visited.add(node)
    inStack.add(node)
    for (const dep of graph.get(node) ?? []) {
      if (dfs(dep)) {
        cycle.push(node)
        return true
      }
    }
    inStack.delete(node)
    return false
  }

  for (const node of graph.keys()) {
    if (dfs(node)) return cycle.reverse()
  }
  return null
}

export function topologicalSort(
  fields: { id: string; formula?: string }[]
): string[] {
  const deps = new Map<string, string[]>()
  const formulaFields = new Set<string>()
  for (const f of fields) {
    if (f.formula) {
      formulaFields.add(f.id)
      deps.set(f.id, extractFieldRefs(f.formula))
    }
  }

  const sorted: string[] = []
  const visited = new Set<string>()

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    for (const dep of deps.get(id) ?? []) {
      if (formulaFields.has(dep)) visit(dep)
    }
    sorted.push(id)
  }

  for (const id of formulaFields) visit(id)
  return sorted
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/__tests__/formulaEngine.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/formulaEngine.ts backend/src/__tests__/formulaEngine.test.ts
git commit -m "feat: add formula engine with recursive-descent parser

Supports arithmetic (+, -, *, /), parentheses, field references
({{field_id}}), and functions (ROUND, ABS, MIN, MAX). Includes
circular reference detection and topological sort for evaluation
ordering."
```

---

### Task 2: Updated Types & Interfaces (Backend + Frontend)

**Files:**
- Modify: `backend/src/models/tenantConfigModel.ts`
- Modify: `frontend/src/models/index.ts`
- Modify: `frontend/src/services/tenantService.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - Backend: `FieldConfig`, `FieldGroup`, `DashboardWidget`, `CoreFieldVisibility` types; updated `TenantConfig` interface
  - Frontend: updated `Lead` interface (no `imageCount`, `boxCount`, `remarks`, `hoUpdate`); matching frontend types

- [ ] **Step 1: Update backend tenant config types**

In `backend/src/models/tenantConfigModel.ts`, replace the `CustomFieldConfig` interface and update `TenantConfig`:

```typescript
// Replace the existing CustomFieldConfig interface:
export interface FieldConfig {
  id:         string
  name:       string
  type:       'text' | 'number' | 'select' | 'date' | 'checkbox' | 'formula'
  required:   boolean
  options:    string[]
  group?:     string
  order:      number
  formula?:   string
  precision?: number
  prefix?:    string
  suffix?:    string
}

// Keep the old name as an alias so existing imports don't break during transition
export type CustomFieldConfig = FieldConfig

export interface FieldGroup {
  id:         string
  name:       string
  order:      number
  collapsed?: boolean
}

export interface DashboardWidget {
  id:              string
  name:            string
  type:            'sum' | 'average' | 'count' | 'min' | 'max' | 'group_by'
  field_id:        string
  group_by_field?: string
  chart_type:      'number' | 'bar' | 'pie' | 'table'
  order:           number
  role:            'admin' | 'sales' | 'both'
}

export interface CoreFieldVisibility {
  probability?: boolean
}
```

Update the `TenantConfig` interface — add `fieldGroups`, `dashboardWidgets`, `coreFieldVisibility`; keep `visibleFields` for backward compat during migration:

```typescript
export interface TenantConfig {
  tenantId:             string
  salesStages:          SalesStageConfig[]
  solutions:            SolutionConfig[]
  customFields:         FieldConfig[]
  visibleFields:        Record<string, boolean>  // deprecated, kept for migration
  fieldGroups:          FieldGroup[]
  dashboardWidgets:     DashboardWidget[]
  coreFieldVisibility:  CoreFieldVisibility
  branding:             BrandingConfig
  updatedAt:            Date | null
}
```

Update the `mapConfig` function to include the new fields:

```typescript
export const mapConfig = (row: Record<string, unknown>): TenantConfig => ({
  tenantId:            row.tenant_id as string,
  salesStages:         (row.sales_stages  as SalesStageConfig[])          || DEFAULT_STAGES,
  solutions:           (row.solutions     as SolutionConfig[])            || DEFAULT_SOLUTIONS,
  customFields:        (row.custom_fields as FieldConfig[])               || [],
  visibleFields:       (row.visible_fields as Record<string, boolean>)    || {},
  fieldGroups:         (row.field_groups as FieldGroup[])                  || [],
  dashboardWidgets:    (row.dashboard_widgets as DashboardWidget[])       || [],
  coreFieldVisibility: (row.core_field_visibility as CoreFieldVisibility) || {},
  branding:            (row.branding      as BrandingConfig)              || {},
  updatedAt:           row.updated_at as Date | null,
})
```

Update the `upsertConfig` function — add the 3 new columns to the INSERT/UPDATE query:

```typescript
export async function upsertConfig(tenantId: string, data: {
  salesStages?:         SalesStageConfig[]
  solutions?:           SolutionConfig[]
  customFields?:        FieldConfig[]
  visibleFields?:       Record<string, boolean>
  fieldGroups?:         FieldGroup[]
  dashboardWidgets?:    DashboardWidget[]
  coreFieldVisibility?: CoreFieldVisibility
  branding?:            BrandingConfig
}): Promise<TenantConfig> {
  const result = await query(
    `INSERT INTO tenant_configs (tenant_id, sales_stages, solutions, custom_fields, visible_fields, field_groups, dashboard_widgets, core_field_visibility, branding)
     VALUES (
       $1,
       COALESCE($2::jsonb, '[]'::jsonb),
       COALESCE($3::jsonb, '[]'::jsonb),
       COALESCE($4::jsonb, '[]'::jsonb),
       COALESCE($5::jsonb, '{}'::jsonb),
       COALESCE($6::jsonb, '[]'::jsonb),
       COALESCE($7::jsonb, '[]'::jsonb),
       COALESCE($8::jsonb, '{}'::jsonb),
       COALESCE($9::jsonb, '{}'::jsonb)
     )
     ON CONFLICT (tenant_id) DO UPDATE SET
       sales_stages          = COALESCE($2::jsonb, tenant_configs.sales_stages),
       solutions             = COALESCE($3::jsonb, tenant_configs.solutions),
       custom_fields         = COALESCE($4::jsonb, tenant_configs.custom_fields),
       visible_fields        = COALESCE($5::jsonb, tenant_configs.visible_fields),
       field_groups           = COALESCE($6::jsonb, tenant_configs.field_groups),
       dashboard_widgets      = COALESCE($7::jsonb, tenant_configs.dashboard_widgets),
       core_field_visibility  = COALESCE($8::jsonb, tenant_configs.core_field_visibility),
       branding              = COALESCE($9::jsonb, tenant_configs.branding),
       updated_at            = NOW()
     RETURNING *`,
    [
      tenantId,
      data.salesStages          != null ? JSON.stringify(data.salesStages)         : null,
      data.solutions            != null ? JSON.stringify(data.solutions)           : null,
      data.customFields         != null ? JSON.stringify(data.customFields)        : null,
      data.visibleFields        != null ? JSON.stringify(data.visibleFields)       : null,
      data.fieldGroups          != null ? JSON.stringify(data.fieldGroups)         : null,
      data.dashboardWidgets     != null ? JSON.stringify(data.dashboardWidgets)    : null,
      data.coreFieldVisibility  != null ? JSON.stringify(data.coreFieldVisibility) : null,
      data.branding             != null ? JSON.stringify(data.branding)            : null,
    ]
  )
  return mapConfig(result.rows[0])
}
```

- [ ] **Step 2: Update frontend types**

In `frontend/src/models/index.ts`, update the `Lead` interface — remove `imageCount`, `boxCount`, `remarks`, `hoUpdate` as top-level fields (they now live in `customFields`):

```typescript
export interface Lead {
  id: string
  companyId?: string | null
  companyName: string
  solution: string
  contacts: Contact[]
  contactName?: string
  contactNumber?: string
  salesStage: SalesStage
  estimatedRevenue: number
  probability: number
  ownerId: string
  ownerEmail: string
  tenantId?: string
  customFields?: Record<string, unknown>
  position?: number
  isDeleted?: boolean
  deletedAt?: ISODateString
  createdAt?: ISODateString
  updatedAt?: ISODateString
}
```

- [ ] **Step 3: Update frontend tenant service types**

In `frontend/src/services/tenantService.ts`, update types to match backend:

```typescript
export interface FieldConfig {
  id:         string
  name:       string
  type:       'text' | 'number' | 'select' | 'date' | 'checkbox' | 'formula'
  required:   boolean
  options:    string[]
  group?:     string
  order:      number
  formula?:   string
  precision?: number
  prefix?:    string
  suffix?:    string
}

export type CustomFieldConfig = FieldConfig

export interface FieldGroup {
  id:         string
  name:       string
  order:      number
  collapsed?: boolean
}

export interface DashboardWidget {
  id:              string
  name:            string
  type:            'sum' | 'average' | 'count' | 'min' | 'max' | 'group_by'
  field_id:        string
  group_by_field?: string
  chart_type:      'number' | 'bar' | 'pie' | 'table'
  order:           number
  role:            'admin' | 'sales' | 'both'
}

export interface CoreFieldVisibility {
  probability?: boolean
}

export interface TenantConfig {
  tenantId:             string
  salesStages:          SalesStageConfig[]
  solutions:            SolutionConfig[]
  customFields:         FieldConfig[]
  visibleFields:        Record<string, boolean>
  fieldGroups:          FieldGroup[]
  dashboardWidgets:     DashboardWidget[]
  coreFieldVisibility:  CoreFieldVisibility
  branding:             BrandingConfig
}
```

- [ ] **Step 4: Update frontend tenant store**

In `frontend/src/store/tenantStore.ts`, add the new exports and selectors:

```typescript
// Add to re-exports
export type { FieldConfig, FieldGroup, DashboardWidget, CoreFieldVisibility }

// Add selectors after existing ones
export const useFieldGroups         = () => useTenantStore(s => s.config?.fieldGroups        ?? [])
export const useDashboardWidgets    = () => useTenantStore(s => s.config?.dashboardWidgets   ?? [])
export const useCoreFieldVisibility = () => useTenantStore(s => s.config?.coreFieldVisibility ?? {})
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd backend && npx tsc --noEmit`
Run: `cd frontend && npx tsc --noEmit`

Note: Frontend will have type errors in LeadForm.tsx and DealModal.tsx since `imageCount`, `boxCount` etc. are removed from `Lead`. These are fixed in Task 5. Confirm only expected errors appear.

- [ ] **Step 6: Commit**

```bash
git add backend/src/models/tenantConfigModel.ts frontend/src/models/index.ts frontend/src/services/tenantService.ts frontend/src/store/tenantStore.ts
git commit -m "feat: add FieldConfig, FieldGroup, DashboardWidget types

Updates TenantConfig across backend and frontend with field_groups,
dashboard_widgets, core_field_visibility. Migrates Lead type to use
customFields JSONB for all non-core fields."
```

---

### Task 3: Database Migration

**Files:**
- Create: `backend/migrations/023_custom_fields_v2.sql`

**Interfaces:**
- Consumes: existing `tenant_configs` and `leads` table structure
- Produces: new columns `field_groups`, `dashboard_widgets`, `core_field_visibility` on `tenant_configs`; migrated lead data in `custom_fields` JSONB

- [ ] **Step 1: Write the migration SQL**

Create `backend/migrations/023_custom_fields_v2.sql`:

```sql
-- Custom Fields V2: Migrate hardcoded fields to unified custom field system
-- This migration is idempotent and preserves all existing data.

-- Step 1: Add new JSONB columns to tenant_configs
ALTER TABLE tenant_configs
  ADD COLUMN IF NOT EXISTS field_groups          JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dashboard_widgets     JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS core_field_visibility JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Step 2: For each tenant, create field definitions for hardcoded fields
-- based on their visible_fields config, and add a default "General" group.
-- Also copy probability visibility into core_field_visibility.
DO $$
DECLARE
  tenant RECORD;
  vis    JSONB;
  existing_cf JSONB;
  new_fields  JSONB;
  merged_cf   JSONB;
  max_order   INT;
BEGIN
  FOR tenant IN SELECT tenant_id, custom_fields, visible_fields FROM tenant_configs LOOP
    vis         := COALESCE(tenant.visible_fields, '{}'::jsonb);
    existing_cf := COALESCE(tenant.custom_fields, '[]'::jsonb);

    -- Find the max order in existing custom fields
    SELECT COALESCE(MAX((elem->>'order')::int), 0)
      INTO max_order
      FROM jsonb_array_elements(existing_cf) AS elem;

    new_fields := '[]'::jsonb;

    -- image_count → std_image_count (if visible or default true)
    IF COALESCE((vis->>'imageCount')::boolean, true) THEN
      new_fields := new_fields || jsonb_build_array(jsonb_build_object(
        'id', 'std_image_count', 'name', 'Image Count', 'type', 'number',
        'required', false, 'options', '[]'::jsonb,
        'group', 'grp_general', 'order', max_order + 1
      ));
      max_order := max_order + 1;
    END IF;

    -- box_count → std_box_count
    IF COALESCE((vis->>'boxCount')::boolean, true) THEN
      new_fields := new_fields || jsonb_build_array(jsonb_build_object(
        'id', 'std_box_count', 'name', 'Box Count', 'type', 'number',
        'required', false, 'options', '[]'::jsonb,
        'group', 'grp_general', 'order', max_order + 1
      ));
      max_order := max_order + 1;
    END IF;

    -- remarks → std_remarks
    IF COALESCE((vis->>'remarks')::boolean, true) THEN
      new_fields := new_fields || jsonb_build_array(jsonb_build_object(
        'id', 'std_remarks', 'name', 'Remarks', 'type', 'text',
        'required', false, 'options', '[]'::jsonb,
        'group', 'grp_general', 'order', max_order + 1
      ));
      max_order := max_order + 1;
    END IF;

    -- ho_update → std_ho_update
    IF COALESCE((vis->>'hoUpdate')::boolean, true) THEN
      new_fields := new_fields || jsonb_build_array(jsonb_build_object(
        'id', 'std_ho_update', 'name', 'HO Update', 'type', 'text',
        'required', false, 'options', '[]'::jsonb,
        'group', 'grp_general', 'order', max_order + 1
      ));
    END IF;

    -- Merge: append new field definitions after existing custom fields
    merged_cf := existing_cf || new_fields;

    -- Add order to existing custom fields that don't have it
    -- and assign them to grp_general
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'order' IS NULL
          THEN elem || jsonb_build_object('order', row_number, 'group', 'grp_general')
        WHEN elem->>'group' IS NULL
          THEN elem || jsonb_build_object('group', 'grp_general')
        ELSE elem
      END
    ) INTO merged_cf
    FROM (
      SELECT elem, ROW_NUMBER() OVER () AS row_number
      FROM jsonb_array_elements(merged_cf) AS elem
    ) sub;

    -- Update tenant config
    UPDATE tenant_configs SET
      custom_fields         = COALESCE(merged_cf, '[]'::jsonb),
      field_groups          = jsonb_build_array(jsonb_build_object(
        'id', 'grp_general', 'name', 'General', 'order', 0, 'collapsed', false
      )),
      core_field_visibility = jsonb_build_object(
        'probability', COALESCE((vis->>'probability')::boolean, true)
      )
    WHERE tenant_id = tenant.tenant_id;
  END LOOP;
END $$;

-- Step 3: Copy lead data from columns into custom_fields JSONB
UPDATE leads SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || jsonb_build_object(
  'std_image_count', COALESCE(image_count, 0),
  'std_box_count',   COALESCE(box_count, 0),
  'std_remarks',     COALESCE(remarks, ''),
  'std_ho_update',   COALESCE(ho_update, '')
);

-- Step 4: Do NOT drop old columns — they are a rollback safety net
-- image_count, box_count, remarks, ho_update stay in the leads table
```

- [ ] **Step 2: Run the migration**

Run: `cd backend && node -e "require('./src/config/db').query(require('fs').readFileSync('migrations/023_custom_fields_v2.sql','utf8')).then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`

Or use whatever migration runner the project uses. Verify:
- `tenant_configs` has the 3 new columns
- Each tenant's `custom_fields` includes `std_image_count`, `std_box_count`, `std_remarks`, `std_ho_update` definitions
- Each lead's `custom_fields` JSONB has values copied from the old columns
- Old columns still exist and still have their data

- [ ] **Step 3: Verify data integrity**

Run these verification queries:
```sql
-- Check that all leads have the migrated fields in custom_fields
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE custom_fields ? 'std_image_count') AS has_image_count,
       COUNT(*) FILTER (WHERE custom_fields ? 'std_box_count') AS has_box_count,
       COUNT(*) FILTER (WHERE custom_fields ? 'std_remarks') AS has_remarks
FROM leads;

-- Spot-check: compare old column vs new JSONB value
SELECT id, image_count, (custom_fields->>'std_image_count')::int AS new_image_count,
       box_count, (custom_fields->>'std_box_count')::int AS new_box_count
FROM leads LIMIT 5;
```

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/023_custom_fields_v2.sql
git commit -m "feat: add migration 023 for custom fields v2

Migrates hardcoded lead fields (image_count, box_count, remarks,
ho_update) into custom_fields JSONB. Adds field_groups,
dashboard_widgets, core_field_visibility columns to tenant_configs.
Old columns preserved as rollback safety net."
```

---

### Task 4: Backend Lead Model & Controller Updates

**Files:**
- Modify: `backend/src/models/leadModel.ts`
- Modify: `backend/src/controllers/leadController.ts`
- Modify: `backend/src/controllers/tenantConfigController.ts`

**Interfaces:**
- Consumes: `FieldConfig` from tenantConfigModel, `evaluateFormula`, `extractFieldRefs`, `detectCircularRefs`, `topologicalSort` from formulaEngine
- Produces: Updated `createLead()`, `updateLead()` that evaluate formulas; updated `mapLead()` that reads from `custom_fields` only; tenant config validation for formula circular refs

- [ ] **Step 1: Update leadModel.ts — mapLead and createLead**

In `backend/src/models/leadModel.ts`:

Update `mapLead` — stop mapping old columns, read from `custom_fields`:

```typescript
export const mapLead = (row: Record<string, unknown>) => ({
  id:               row.id,
  companyId:        (row.company_id as string) ?? null,
  companyName:      row.company_name,
  solution:         row.solution,
  contacts:         row.contacts,
  salesStage:       row.sales_stage,
  estimatedRevenue: parseFloat(row.estimated_revenue as string),
  probability:      row.probability,
  position:         row.position,
  ownerId:          row.owner_id,
  ownerEmail:       row.owner_email,
  tenantId:         row.tenant_id,
  customFields:     row.custom_fields ?? {},
  isDeleted:        row.is_deleted,
  deletedAt:        row.deleted_at,
  createdAt:        row.created_at,
  updatedAt:        row.updated_at,
})
```

Update `createLead` function signature — remove `imageCount`, `boxCount`, `remarks`, `hoUpdate` params. The SQL INSERT still writes to old columns (with defaults) for rollback safety, but values come from `customFields`:

```typescript
export async function createLead(data: {
  companyName:      string
  companyId?:       string | null
  solution:         string
  contacts:         unknown[]
  salesStage:       string
  estimatedRevenue: number
  probability:      number
  position:         number | null
  ownerId:          string
  ownerEmail:       string
  tenantId:         string
  customFields?:    Record<string, unknown>
}) {
  const cf = data.customFields ?? {}
  const result = await query(
    `INSERT INTO leads
       (company_name, company_id, solution, contacts, sales_stage,
        image_count, box_count, estimated_revenue, probability, remarks,
        ho_update, position, owner_id, owner_email, tenant_id, custom_fields)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      data.companyName,
      data.companyId ?? null,
      data.solution,
      JSON.stringify(data.contacts),
      data.salesStage,
      (cf['std_image_count'] as number) ?? 0,
      (cf['std_box_count'] as number) ?? 0,
      data.estimatedRevenue,
      data.probability,
      (cf['std_remarks'] as string) ?? '',
      (cf['std_ho_update'] as string) ?? '',
      data.position,
      data.ownerId,
      data.ownerEmail,
      data.tenantId,
      JSON.stringify(cf),
    ]
  )
  return mapLead(result.rows[0])
}
```

Similarly update `updateLead` — remove `imageCount`, `boxCount`, `remarks`, `hoUpdate` from the params, write them from `customFields` for column backward compat:

```typescript
export async function updateLead(id: string, tenantId: string, data: {
  companyName?:      string
  companyId?:        string | null
  solution?:         string
  contacts?:         unknown[]
  salesStage?:       string
  estimatedRevenue?: number
  probability?:      number
  position?:         number | null
  ownerId?:          string
  ownerEmail?:       string
  customFields?:     Record<string, unknown>
}) {
  const cf = data.customFields
  const result = await query(
    `UPDATE leads SET
       company_name      = COALESCE($1,  company_name),
       company_id        = COALESCE($2,  company_id),
       solution          = COALESCE($3,  solution),
       contacts          = COALESCE($4,  contacts),
       sales_stage       = COALESCE($5,  sales_stage),
       image_count       = COALESCE($6,  image_count),
       box_count         = COALESCE($7,  box_count),
       estimated_revenue = COALESCE($8,  estimated_revenue),
       probability       = COALESCE($9,  probability),
       remarks           = COALESCE($10, remarks),
       ho_update         = COALESCE($11, ho_update),
       position          = COALESCE($12, position),
       owner_id          = COALESCE($13, owner_id),
       owner_email       = COALESCE($14, owner_email),
       custom_fields     = COALESCE($15, custom_fields)
     WHERE id = $16 AND tenant_id = $17
     RETURNING *`,
    [
      data.companyName,
      data.companyId !== undefined ? data.companyId : null,
      data.solution,
      data.contacts !== undefined ? JSON.stringify(data.contacts) : null,
      data.salesStage,
      cf ? (cf['std_image_count'] as number ?? null) : null,
      cf ? (cf['std_box_count'] as number ?? null) : null,
      data.estimatedRevenue,
      data.probability,
      cf ? (cf['std_remarks'] as string ?? null) : null,
      cf ? (cf['std_ho_update'] as string ?? null) : null,
      data.position,
      data.ownerId,
      data.ownerEmail,
      cf !== undefined ? JSON.stringify(cf) : null,
      id,
      tenantId,
    ]
  )
  return result.rows[0] ? mapLead(result.rows[0]) : null
}
```

- [ ] **Step 2: Update leadController.ts — formula evaluation + backward compat**

In `backend/src/controllers/leadController.ts`:

Add imports at top:
```typescript
import { evaluateFormula, topologicalSort } from '../utils/formulaEngine'
import { FieldConfig, findConfigByTenantId } from '../models/tenantConfigModel'
```

Add formula evaluation helper:
```typescript
async function evaluateFormulaFields(
  tenantId: string,
  customFields: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const config = await findConfigByTenantId(tenantId)
  if (!config) return customFields

  const formulaFields = config.customFields.filter(f => f.type === 'formula' && f.formula)
  if (formulaFields.length === 0) return customFields

  const sortedIds = topologicalSort(formulaFields)
  const result = { ...customFields }
  const numericValues: Record<string, number> = {}

  // Collect all numeric values
  for (const [key, val] of Object.entries(result)) {
    if (typeof val === 'number') numericValues[key] = val
    else if (typeof val === 'string' && !isNaN(Number(val))) numericValues[key] = Number(val)
  }

  // Evaluate formulas in topological order
  for (const fieldId of sortedIds) {
    const field = formulaFields.find(f => f.id === fieldId)
    if (!field?.formula) continue
    try {
      const value = evaluateFormula(field.formula, numericValues)
      result[fieldId] = value
      numericValues[fieldId] = value
    } catch {
      result[fieldId] = 0
    }
  }

  return result
}
```

Add backward compatibility mapper (accepts old-format fields, maps to customFields):
```typescript
function mapLegacyFieldsToCustom(body: Record<string, unknown>): Record<string, unknown> {
  const cf = (body.customFields as Record<string, unknown>) ?? {}
  const mapping: Record<string, string> = {
    imageCount: 'std_image_count',
    boxCount:   'std_box_count',
    remarks:    'std_remarks',
    hoUpdate:   'std_ho_update',
  }
  for (const [oldKey, newKey] of Object.entries(mapping)) {
    if (body[oldKey] !== undefined && cf[newKey] === undefined) {
      cf[newKey] = body[oldKey]
    }
  }
  return cf
}
```

Update `createLeadHandler` — use `mapLegacyFieldsToCustom` and `evaluateFormulaFields`:

In the destructuring at the top, keep `imageCount`, `boxCount`, `remarks`, `hoUpdate` for backward compat. After building customFields via `mapLegacyFieldsToCustom(req.body)`, call `evaluateFormulaFields(tenantId, mergedCf)` before passing to `createLead`.

**Important:** The lead-limit branch (lines ~174-220) has an inline SQL INSERT that also references `imageCount`, `boxCount`, `remarks`, `hoUpdate`. Update it to read these from the merged `customFields` object instead, matching the pattern used in the updated `createLead()` function. The inline INSERT should use `cf['std_image_count'] ?? 0`, `cf['std_box_count'] ?? 0`, `cf['std_remarks'] ?? ''`, `cf['std_ho_update'] ?? ''` for backward-compat column writes.

Update `updateLeadHandler` similarly — merge existing custom fields with incoming, evaluate formulas, pass to `updateLead`.

Remove `imageCount`, `boxCount`, `remarks`, `hoUpdate` from the direct field passing to `createLead`/`updateLead` — they now flow through `customFields`.

- [ ] **Step 3: Update tenantConfigController.ts — validate formulas on config save**

In `backend/src/controllers/tenantConfigController.ts`, add formula validation in `updateConfig`:

```typescript
import { detectCircularRefs } from '../utils/formulaEngine'
```

In the `updateConfig` function, before calling `upsertConfig`, add:

```typescript
// Validate formula fields for circular references
if (customFields != null) {
  const formulaFields = (customFields as FieldConfig[]).filter(
    (f: FieldConfig) => f.type === 'formula' && f.formula
  )
  if (formulaFields.length > 0) {
    const cycle = detectCircularRefs(formulaFields)
    if (cycle) {
      res.status(400).json({
        error: `Circular reference detected: ${cycle.join(' → ')}`
      })
      return
    }
  }
}
```

Update the `upsertConfig` call to pass new fields:
```typescript
const config = await upsertConfig(tenantId, {
  salesStages, solutions, customFields, visibleFields,
  fieldGroups, dashboardWidgets, coreFieldVisibility, branding,
})
```

Update the default config response in `getConfig` to include new fields:
```typescript
if (!config) {
  res.json({
    tenantId:             req.user!.tenantId,
    salesStages:          DEFAULT_STAGES,
    solutions:            DEFAULT_SOLUTIONS,
    customFields:         [],
    visibleFields:        {},
    fieldGroups:          [],
    dashboardWidgets:     [],
    coreFieldVisibility:  { probability: true },
    branding:             {},
  })
  return
}
```

- [ ] **Step 4: Verify backend compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/leadModel.ts backend/src/controllers/leadController.ts backend/src/controllers/tenantConfigController.ts
git commit -m "feat: update lead model and controllers for custom fields v2

Lead model reads from custom_fields JSONB, writes back to old columns
for rollback safety. Controller evaluates formula fields on write,
maps legacy field names for backward compat, validates circular refs
on tenant config save."
```

---

### Task 5: Custom Widget KPI Endpoint

**Files:**
- Modify: `backend/src/controllers/kpiController.ts`
- Modify: `backend/src/routes/kpis.ts`

**Interfaces:**
- Consumes: `DashboardWidget` from tenantConfigModel, `findConfigByTenantId`
- Produces: `GET /api/kpis/custom-widgets` → `{ widgets: { id, name, chart_type, data }[] }`

- [ ] **Step 1: Add the custom widgets endpoint**

In `backend/src/controllers/kpiController.ts`, add:

```typescript
import { findConfigByTenantId, DashboardWidget } from '../models/tenantConfigModel';

export async function getCustomWidgets(req: Request, res: Response) {
  const isAdmin  = req.user!.role === 'admin'
  const userId   = req.user!.userId
  const tenantId = req.user!.tenantId

  try {
    const config = await findConfigByTenantId(tenantId)
    if (!config || config.dashboardWidgets.length === 0) {
      res.json({ widgets: [] })
      return
    }

    const roleFilter = isAdmin ? 'admin' : 'sales'
    const widgets = config.dashboardWidgets.filter(
      w => w.role === 'both' || w.role === roleFilter
    )

    const ownerClause = isAdmin ? '' : 'AND owner_id = $2'
    const baseParams  = isAdmin ? [tenantId] : [tenantId, userId]

    const results = []

    for (const widget of widgets) {
      const fieldParam = widget.field_id

      if (widget.type === 'group_by' && widget.group_by_field) {
        const groupField = widget.group_by_field
        const result = await query(
          `SELECT
             custom_fields->>$${baseParams.length + 1} AS group_key,
             SUM((custom_fields->>$${baseParams.length + 2})::numeric) AS total,
             AVG((custom_fields->>$${baseParams.length + 2})::numeric) AS average,
             COUNT(*) AS count
           FROM leads
           WHERE is_deleted = FALSE AND tenant_id = $1 ${ownerClause}
             AND custom_fields->>$${baseParams.length + 2} IS NOT NULL
           GROUP BY custom_fields->>$${baseParams.length + 1}
           ORDER BY total DESC`,
          [...baseParams, groupField, fieldParam]
        )
        results.push({
          id:         widget.id,
          name:       widget.name,
          chart_type: widget.chart_type,
          data:       result.rows.map(r => ({
            group:   r.group_key ?? 'Unknown',
            total:   parseFloat(r.total) || 0,
            average: parseFloat(r.average) || 0,
            count:   parseInt(r.count),
          })),
        })
      } else {
        // Scalar aggregation (sum, average, count, min, max)
        const aggFunc = {
          sum:     'SUM',
          average: 'AVG',
          count:   'COUNT',
          min:     'MIN',
          max:     'MAX',
        }[widget.type] || 'SUM'

        const valueExpr = widget.type === 'count'
          ? 'COUNT(*)'
          : `${aggFunc}((custom_fields->>$${baseParams.length + 1})::numeric)`

        const result = await query(
          `SELECT ${valueExpr} AS value
           FROM leads
           WHERE is_deleted = FALSE AND tenant_id = $1 ${ownerClause}
             ${widget.type !== 'count' ? `AND custom_fields->>$${baseParams.length + 1} IS NOT NULL` : ''}`,
          widget.type === 'count' ? baseParams : [...baseParams, fieldParam]
        )

        results.push({
          id:         widget.id,
          name:       widget.name,
          chart_type: widget.chart_type,
          data:       { value: parseFloat(result.rows[0]?.value) || 0 },
        })
      }
    }

    res.json({ widgets: results })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
}
```

- [ ] **Step 2: Add route**

In `backend/src/routes/kpis.ts`, add:

```typescript
import { getKpis, getCustomWidgets } from '../controllers/kpiController';

router.get('/custom-widgets', requireAuth, getCustomWidgets);
```

- [ ] **Step 3: Verify compilation**

Run: `cd backend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/kpiController.ts backend/src/routes/kpis.ts
git commit -m "feat: add GET /api/kpis/custom-widgets endpoint

Computes tenant-configured dashboard widget data from custom_fields
JSONB. Supports scalar aggregations (sum, avg, count, min, max) and
group-by queries. Role-filtered per widget config."
```

---

### Task 6: Frontend — LeadForm & DealModal Updates

**Files:**
- Modify: `frontend/src/components/leads/LeadForm.tsx`
- Modify: `frontend/src/components/kanban/DealModal.tsx`

**Interfaces:**
- Consumes: `FieldConfig`, `FieldGroup` from tenantStore; `useFieldGroups`, `useCoreFieldVisibility` selectors
- Produces: Updated forms that render all fields dynamically from tenant config, with grouped collapsible sections and formula display

- [ ] **Step 1: Update LeadForm.tsx**

Remove `imageCount`, `boxCount`, `remarks`, `hoUpdate` from the `leadSchema` zod object and `defaultValues`. Remove the hardcoded conditional field blocks (`visibleFields['imageCount'] !== false`, etc.).

Replace the custom fields section with a grouped rendering approach:

```typescript
// Replace useVisibleFields with useCoreFieldVisibility and useFieldGroups
const fieldGroups       = useFieldGroups()
const coreFieldVis      = useCoreFieldVisibility()

// Group custom fields by group
const fieldsByGroup = useMemo(() => {
  const grouped = new Map<string, FieldConfig[]>()
  for (const cf of customFields) {
    const groupId = cf.group ?? 'grp_general'
    const list = grouped.get(groupId) ?? []
    list.push(cf)
    grouped.set(groupId, list)
  }
  // Sort fields within each group by order
  for (const [, list] of grouped) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  return grouped
}, [customFields])

// Sort groups by order
const sortedGroups = useMemo(() => {
  const groups = fieldGroups.length > 0
    ? [...fieldGroups].sort((a, b) => a.order - b.order)
    : [{ id: 'grp_general', name: 'Additional Fields', order: 0 }]
  return groups.filter(g => fieldsByGroup.has(g.id))
}, [fieldGroups, fieldsByGroup])
```

Render each group as a collapsible section. Formula fields render as read-only with a computed display. Use `coreFieldVis.probability !== false` instead of `visibleFields['probability'] !== false`.

Remove `imageCount`, `boxCount`, `remarks`, `hoUpdate` from the `onSave` call — they're now part of `customFieldValues`.

- [ ] **Step 2: Update DealModal.tsx similarly**

Same changes as LeadForm: remove hardcoded field references from zod schema, default values, and JSX. Use grouped rendering. Pre-populate `customFieldValues` from `lead.customFields` when editing.

- [ ] **Step 3: Update ImportStep1Upload.tsx if it references old fields**

Check `frontend/src/components/leads/ImportStep1Upload.tsx` — if it maps `imageCount`/`boxCount`/`remarks`/`hoUpdate` as import columns, update it to map them to `customFields.std_*` keys instead.

- [ ] **Step 4: Verify frontend compiles and renders**

Run: `cd frontend && npx tsc --noEmit`
Start the dev server and test: create a lead, edit a lead via DealModal, verify custom fields display in groups.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/leads/LeadForm.tsx frontend/src/components/kanban/DealModal.tsx
git commit -m "feat: update LeadForm and DealModal for unified custom fields

All fields now render dynamically from tenant config with collapsible
group sections. Formula fields display as read-only computed values.
Hardcoded imageCount/boxCount/remarks/hoUpdate references removed."
```

---

### Task 7: Frontend — Redesigned LeadFieldSettings

**Files:**
- Modify: `frontend/src/components/settings/LeadFieldSettings.tsx`

**Interfaces:**
- Consumes: `FieldConfig`, `FieldGroup`, `CoreFieldVisibility` from tenantStore
- Produces: Updated settings component with group management, formula editor, field formatting options (prefix, suffix, precision)

- [ ] **Step 1: Redesign LeadFieldSettings.tsx**

Replace the current component entirely. The new version:

1. **Group management section** at the top — add/rename/reorder/delete groups
2. **Fields listed by group** — each group is a collapsible section showing its fields
3. **Field editor** — expanded view includes:
   - Name, type (now includes 'formula'), required toggle
   - For `number`: precision, prefix, suffix inputs
   - For `select`: options management (existing code)
   - For `formula`: expression text input, field reference picker (shows numeric/formula fields as clickable chips), live preview
4. **Move fields between groups** — dropdown to select group
5. **Remove standard field visibility toggles** — those fields are now in the custom fields list and can be deleted

Props change:
```typescript
interface LeadFieldSettingsProps {
  customFields:         FieldConfig[]
  fieldGroups:          FieldGroup[]
  coreFieldVisibility:  CoreFieldVisibility
  onChangeCustom:       (fields: FieldConfig[]) => void
  onChangeGroups:       (groups: FieldGroup[]) => void
  onChangeCoreVis:      (vis: CoreFieldVisibility) => void
  isSaving:             boolean
  onSave:               () => void
}
```

The formula editor section (shown when field type is 'formula'):
```tsx
{expandedId === field.id && field.type === 'formula' && (
  <CardContent className="p-3 pt-2 space-y-3">
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">Formula Expression</Label>
      <Input
        value={field.formula ?? ''}
        onChange={e => updateField(field.id, { formula: e.target.value })}
        placeholder="e.g. {{cf_qty}} * {{cf_price}}"
        className="font-mono text-sm"
      />
    </div>

    {/* Available field chips */}
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">Insert Field Reference</Label>
      <div className="flex flex-wrap gap-1">
        {customFields
          .filter(f => f.id !== field.id && (f.type === 'number' || f.type === 'formula'))
          .map(f => (
            <button
              key={f.id}
              type="button"
              className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded"
              onClick={() => updateField(field.id, {
                formula: (field.formula ?? '') + `{{${f.id}}}`
              })}
            >
              {f.name}
            </button>
          ))}
      </div>
    </div>

    {/* Live preview */}
    <div className="bg-muted rounded p-2 text-xs">
      <span className="text-muted-foreground">Preview: </span>
      <span className="font-mono">
        {(() => {
          try {
            if (!field.formula) return '—'
            const sampleValues: Record<string, number> = {}
            customFields.forEach(f => {
              if (f.type === 'number' || f.type === 'formula') sampleValues[f.id] = 100
            })
            return evaluateFormula(field.formula, sampleValues)
          } catch (e) {
            return `Error: ${(e as Error).message}`
          }
        })()}
      </span>
    </div>
  </CardContent>
)}
```

Note: Import `evaluateFormula` from a shared formula util. Since the engine is backend-only, create a lightweight frontend copy or extract the formula engine into a shared package. The simplest approach: copy `evaluateFormula`, `tokenize`, `parse`, `evaluate` into `frontend/src/lib/utils/formulaEngine.ts` (same code, no node dependencies).

- [ ] **Step 2: Update WorkspaceSettings.tsx**

Update the props passed to `LeadFieldSettings`:

```typescript
const [fieldGroups, setFieldGroups] = useState<FieldGroup[]>([])
const [coreFieldVis, setCoreFieldVis] = useState<CoreFieldVisibility>({})

// In useEffect for config init:
setFieldGroups(config.fieldGroups)
setCoreFieldVis(config.coreFieldVisibility)
```

Update the save call for the fields tab:
```typescript
onSave={() => save({ customFields, fieldGroups, coreFieldVisibility: coreFieldVis })}
```

- [ ] **Step 3: Copy formula engine to frontend**

Create `frontend/src/lib/utils/formulaEngine.ts` — copy the `tokenize`, `parse`, `evaluate`, `evaluateFormula`, `extractFieldRefs` functions from `backend/src/utils/formulaEngine.ts`. Only the functions needed for the preview — no `detectCircularRefs` or `topologicalSort` needed on the frontend.

- [ ] **Step 4: Verify and test**

Run: `cd frontend && npx tsc --noEmit`
Test in browser: go to Workspace Settings → Lead Fields tab. Verify groups, formula editor, field picker chips all render and work.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/settings/LeadFieldSettings.tsx frontend/src/pages/admin/WorkspaceSettings.tsx frontend/src/lib/utils/formulaEngine.ts
git commit -m "feat: redesign LeadFieldSettings with groups and formula editor

Groups section for organizing fields. Formula type with expression
builder, field reference chips, and live preview. Shared formula
engine for frontend preview evaluation."
```

---

### Task 8: Frontend — Dashboard Widget Settings & Rendering

**Files:**
- Create: `frontend/src/components/settings/DashboardWidgetSettings.tsx`
- Create: `frontend/src/components/dashboard/CustomWidgets.tsx`
- Modify: `frontend/src/pages/admin/WorkspaceSettings.tsx`
- Modify: `frontend/src/pages/admin/AdminDashboard.tsx`
- Modify: `frontend/src/pages/sales/SalesDashboard.tsx`

**Interfaces:**
- Consumes: `DashboardWidget`, `FieldConfig` from tenantStore; `GET /api/kpis/custom-widgets` API
- Produces: Widget settings tab in WorkspaceSettings; Custom Analytics section on dashboards

- [ ] **Step 1: Create DashboardWidgetSettings.tsx**

Create `frontend/src/components/settings/DashboardWidgetSettings.tsx`:

```typescript
import { useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { DashboardWidget, FieldConfig } from '@/store/tenantStore'

interface DashboardWidgetSettingsProps {
  widgets:      DashboardWidget[]
  customFields: FieldConfig[]
  onChange:     (widgets: DashboardWidget[]) => void
  isSaving:     boolean
  onSave:       () => void
}

const WIDGET_TYPES = [
  { value: 'sum',      label: 'Sum' },
  { value: 'average',  label: 'Average' },
  { value: 'count',    label: 'Count' },
  { value: 'min',      label: 'Min' },
  { value: 'max',      label: 'Max' },
  { value: 'group_by', label: 'Group By' },
] as const

const CHART_TYPES = [
  { value: 'number', label: 'KPI Card' },
  { value: 'bar',    label: 'Bar Chart' },
  { value: 'pie',    label: 'Pie Chart' },
  { value: 'table',  label: 'Table' },
] as const

const ROLES = [
  { value: 'both',  label: 'Both' },
  { value: 'admin', label: 'Admin Only' },
  { value: 'sales', label: 'Sales Only' },
] as const

export function DashboardWidgetSettings({
  widgets, customFields, onChange, isSaving, onSave,
}: DashboardWidgetSettingsProps) {
  const numericFields = customFields.filter(f => f.type === 'number' || f.type === 'formula')
  const selectFields  = customFields.filter(f => f.type === 'select')

  const addWidget = () => {
    const widget: DashboardWidget = {
      id:         `wgt_${Date.now()}`,
      name:       '',
      type:       'sum',
      field_id:   numericFields[0]?.id ?? '',
      chart_type: 'number',
      order:      widgets.length,
      role:       'both',
    }
    onChange([...widgets, widget])
  }

  const updateWidget = (id: string, patch: Partial<DashboardWidget>) => {
    onChange(widgets.map(w => w.id === id ? { ...w, ...patch } : w))
  }

  const removeWidget = (id: string) => {
    onChange(widgets.filter(w => w.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Dashboard Widgets</h3>
        <Button onClick={addWidget} size="sm" variant="outline" disabled={numericFields.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Add Widget
        </Button>
      </div>

      {numericFields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add numeric or formula custom fields first to create dashboard widgets.
        </p>
      )}

      <div className="space-y-3">
        {widgets.map(widget => (
          <Card key={widget.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={widget.name}
                  onChange={e => updateWidget(widget.id, { name: e.target.value })}
                  placeholder="Widget name"
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeWidget(widget.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Aggregation</Label>
                  <Select value={widget.type} onValueChange={v => updateWidget(widget.id, { type: v as DashboardWidget['type'] })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WIDGET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Field</Label>
                  <Select value={widget.field_id} onValueChange={v => updateWidget(widget.id, { field_id: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {widget.type === 'group_by' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Group By</Label>
                    <Select value={widget.group_by_field ?? ''} onValueChange={v => updateWidget(widget.id, { group_by_field: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select field" /></SelectTrigger>
                      <SelectContent>
                        {selectFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Chart Type</Label>
                  <Select value={widget.chart_type} onValueChange={v => updateWidget(widget.id, { chart_type: v as DashboardWidget['chart_type'] })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHART_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Visible To</Label>
                  <Select value={widget.role} onValueChange={v => updateWidget(widget.id, { role: v as DashboardWidget['role'] })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Saving…' : 'Save Widgets'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create CustomWidgets.tsx**

Create `frontend/src/components/dashboard/CustomWidgets.tsx`:

```typescript
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { apiFetch } from '@/config/api'
import { useCustomFields } from '@/store/tenantStore'
import { formatCompactNumber } from '@/lib/utils/formatters'

interface WidgetData {
  id: string
  name: string
  chart_type: 'number' | 'bar' | 'pie' | 'table'
  data: { value: number } | { group: string; total: number; average: number; count: number }[]
}

const COLORS = ['#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#EC4899', '#EAB308', '#06B6D4', '#F43F5E']

export function CustomWidgets() {
  const [widgets, setWidgets] = useState<WidgetData[]>([])
  const [loading, setLoading] = useState(true)
  const customFields = useCustomFields()

  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const result = await apiFetch<{ widgets: WidgetData[] }>('/api/kpis/custom-widgets')
        setWidgets(result.widgets)
      } catch (err) {
        console.error('Failed to load custom widgets:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchWidgets()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (widgets.length === 0) return null

  const getFieldPrefix = (fieldId: string) =>
    customFields.find(f => f.id === fieldId)?.prefix ?? ''
  const getFieldSuffix = (fieldId: string) =>
    customFields.find(f => f.id === fieldId)?.suffix ?? ''

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Custom Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgets.map(widget => (
          <Card key={widget.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{widget.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {widget.chart_type === 'number' && !Array.isArray(widget.data) && (
                <div className="text-3xl font-bold">
                  {formatCompactNumber((widget.data as { value: number }).value)}
                </div>
              )}

              {widget.chart_type === 'bar' && Array.isArray(widget.data) && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={widget.data}>
                    <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {widget.chart_type === 'pie' && Array.isArray(widget.data) && (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={widget.data}
                      dataKey="total"
                      nameKey="group"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ group }) => group}
                    >
                      {widget.data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {widget.chart_type === 'table' && Array.isArray(widget.data) && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1">Group</th>
                      <th className="py-1 text-right">Count</th>
                      <th className="py-1 text-right">Total</th>
                      <th className="py-1 text-right">Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {widget.data.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1">{row.group}</td>
                        <td className="py-1 text-right">{row.count}</td>
                        <td className="py-1 text-right">{formatCompactNumber(row.total)}</td>
                        <td className="py-1 text-right">{formatCompactNumber(row.average)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add Dashboard Widgets tab to WorkspaceSettings**

In `frontend/src/pages/admin/WorkspaceSettings.tsx`:

Add imports:
```typescript
import { DashboardWidgetSettings } from '@/components/settings/DashboardWidgetSettings'
import { BarChart3 } from 'lucide-react'
import type { FieldGroup, DashboardWidget, CoreFieldVisibility } from '@/store/tenantStore'
```

Add state:
```typescript
const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
```

Init from config:
```typescript
setDashboardWidgets(config.dashboardWidgets)
```

Update TabsList to 5 columns (`grid-cols-5`) and add the new tab:
```tsx
<TabsTrigger value="widgets" className="flex items-center gap-1.5 text-xs">
  <BarChart3 className="h-3.5 w-3.5" /> Widgets
</TabsTrigger>
```

Add TabsContent:
```tsx
<TabsContent value="widgets">
  <Card>
    <CardHeader>
      <CardTitle>Dashboard Widgets</CardTitle>
      <CardDescription>Configure custom analytics widgets for the dashboard</CardDescription>
    </CardHeader>
    <CardContent>
      <DashboardWidgetSettings
        widgets={dashboardWidgets}
        customFields={customFields}
        onChange={setDashboardWidgets}
        isSaving={isSaving}
        onSave={() => save({ dashboardWidgets })}
      />
    </CardContent>
  </Card>
</TabsContent>
```

- [ ] **Step 4: Add CustomWidgets to AdminDashboard and SalesDashboard**

In `frontend/src/pages/admin/AdminDashboard.tsx`, add after the existing dashboard sections:
```tsx
import { CustomWidgets } from '@/components/dashboard/CustomWidgets'

// At the end of the dashboard content, before closing tags:
<CustomWidgets />
```

In `frontend/src/pages/sales/SalesDashboard.tsx`, add the same import and component.

- [ ] **Step 5: Verify and test**

Run: `cd frontend && npx tsc --noEmit`
Test in browser:
1. Go to Workspace Settings → Widgets tab, add a KPI Card widget
2. Go to Admin Dashboard — see the Custom Analytics section
3. Add a group_by widget with a bar chart
4. Verify charts render correctly

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/settings/DashboardWidgetSettings.tsx frontend/src/components/dashboard/CustomWidgets.tsx frontend/src/pages/admin/WorkspaceSettings.tsx frontend/src/pages/admin/AdminDashboard.tsx frontend/src/pages/sales/SalesDashboard.tsx
git commit -m "feat: add dashboard widget settings and custom analytics rendering

New Widgets tab in Workspace Settings for configuring dashboard
analytics. CustomWidgets component renders KPI cards, bar charts,
pie charts, and summary tables from custom field data using Recharts."
```

---

### Task 9: End-to-End Testing & Cleanup

**Files:**
- All modified files
- Modify: `frontend/src/components/leads/ImportStep1Upload.tsx` (if needed)

**Interfaces:**
- Consumes: everything from Tasks 1-8
- Produces: verified working system

- [ ] **Step 1: Verify backend compiles cleanly**

Run: `cd backend && npx tsc --noEmit`
Fix any remaining type errors.

- [ ] **Step 2: Verify frontend compiles cleanly**

Run: `cd frontend && npx tsc --noEmit`
Fix any remaining type errors (especially in ImportStep1Upload.tsx or any other files that reference `imageCount`, `boxCount`, `remarks`, `hoUpdate` on the `Lead` type).

- [ ] **Step 3: Run existing tests**

Run: `cd backend && npx jest --no-coverage`
All existing tests should pass. Fix any failures.

- [ ] **Step 4: Manual end-to-end test**

Start both servers and test:
1. **Migration verification**: Check that existing leads have `std_*` values in their `customFields`
2. **Create lead**: Open LeadForm, verify custom fields render in groups, create a lead
3. **Edit lead**: Open DealModal, verify fields pre-populate, edit and save
4. **Formula fields**: Add a formula field (qty × price), create a lead with qty=10, price=100, verify formula shows 1000
5. **Settings**: Go to Lead Fields tab, add a group, move fields between groups, add a formula field
6. **Dashboard widgets**: Add a KPI card widget, verify it shows on dashboard
7. **Multi-tenant**: Log in as a different tenant, verify their fields are independent

- [ ] **Step 5: Fix any issues found**

Address any bugs from manual testing.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "fix: resolve remaining type errors and cleanup for custom fields v2"
```
