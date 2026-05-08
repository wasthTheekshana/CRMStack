# Playwright E2E Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone `e2e/` package at the project root with a Playwright test suite covering login security, cross-tenant isolation, and the analytics drill-down UI.

**Architecture:** Playwright runs against live local servers (frontend :3000, backend :4000). A `global-setup` script seeds two isolated test tenants directly into PostgreSQL before any tests run; `global-teardown` deletes them after. A custom Playwright fixture intercepts every `/api/` request on the test page and injects `X-Tenant-Subdomain` to simulate nginx's subdomain routing. Settings security is tested at the API level using the Bearer token returned by login.

**Tech Stack:** `@playwright/test`, TypeScript, `pg` (direct DB seed/teardown), `bcryptjs`, `dotenv`

---

## File Map

| File | Purpose |
|------|---------|
| `e2e/package.json` | Package deps and test scripts |
| `e2e/tsconfig.json` | TypeScript config for the e2e package |
| `e2e/.gitignore` | Ignore node_modules, seed-data.json, reports |
| `e2e/playwright.config.ts` | Playwright config — baseURL, globalSetup, webServer |
| `e2e/helpers/seed.ts` | DB connect, `seedTestData()`, `teardownTestData()` |
| `e2e/global-setup.ts` | Calls `seedTestData()`, writes `fixtures/seed-data.json` |
| `e2e/global-teardown.ts` | Reads seed-data.json, calls `teardownTestData()`, deletes file |
| `e2e/fixtures/index.ts` | Custom `test` with `tenantPage` and `authedPage` fixtures + `loadSeedData()` |
| `e2e/helpers/api.ts` | `apiLogin()` and `apiFetch()` for API-level tests |
| `e2e/tests/auth.spec.ts` | 5 auth tests |
| `e2e/tests/settings.spec.ts` | 5 settings security tests |
| `e2e/tests/analytics.spec.ts` | 5 analytics drill-down UI tests |

---

## Task 1: Bootstrap the e2e package

**Files:**
- Create: `e2e/package.json`
- Create: `e2e/tsconfig.json`
- Create: `e2e/.gitignore`

- [ ] **Step 1: Create `e2e/package.json`**

```json
{
  "name": "e2e",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:report": "playwright show-report",
    "test:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "^1.44.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.0.0",
    "@types/pg": "^8.11.0",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.4.5",
    "pg": "^8.11.5",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `e2e/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `e2e/.gitignore`**

```
node_modules/
dist/
fixtures/seed-data.json
playwright-report/
test-results/
```

- [ ] **Step 4: Install dependencies**

```bash
cd e2e
npm install
npx playwright install chromium
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Verify Playwright is installed**

```bash
npx playwright --version
```

Expected output: `Version 1.44.x` (or higher)

- [ ] **Step 6: Commit**

```bash
cd ..
git add e2e/package.json e2e/tsconfig.json e2e/.gitignore
git commit -m "chore: bootstrap e2e package"
```

---

## Task 2: Seed helpers and global setup/teardown

**Files:**
- Create: `e2e/helpers/seed.ts`
- Create: `e2e/global-setup.ts`
- Create: `e2e/global-teardown.ts`

> **Context:** The backend DB vars are in `backend/.env`: `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=dokcrm`, `DB_USER=dokcrm`, `DB_PASSWORD=dokcrm@local123`. The `tenants` table requires `name`, `subdomain`, `plan` (must be one of `'starter' | 'business' | 'enterprise'`), `status`, `user_limit`, `owner_email`. The `users` table requires `email`, `username` (unique, lowercased), `display_name`, `password_hash`, `role`, `tenant_id`. Nine leads are seeded with distinct solution names so the analytics pie chart has data (8+ solutions needed to produce an "Others" bucket).

- [ ] **Step 1: Create `e2e/helpers/seed.ts`**

```typescript
import { Client } from 'pg'
import bcrypt from 'bcryptjs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(process.cwd(), '../backend/.env') })

function getDbClient() {
  return new Client({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'dokcrm',
    user:     process.env.DB_USER     || 'dokcrm',
    password: process.env.DB_PASSWORD,
  })
}

export interface SeedData {
  tenants: {
    dok: { id: string; subdomain: string }
    atl: { id: string; subdomain: string }
  }
  users: {
    dokAdmin: { id: string; email: string; username: string; password: string }
    dokSales: { id: string; email: string; username: string; password: string }
    atlAdmin: { id: string; email: string; username: string; password: string }
    atlSales: { id: string; email: string; username: string; password: string }
  }
}

const PASSWORD = 'TestPass@123'

const SOLUTIONS = [
  'Alpha Suite', 'Beta Platform', 'Gamma Cloud', 'Delta Analytics',
  'Epsilon Connect', 'Zeta Secure', 'Eta Manager', 'Theta Insights', 'Iota Flow',
]

export async function seedTestData(): Promise<SeedData> {
  const client = getDbClient()
  await client.connect()
  try {
    const hash = await bcrypt.hash(PASSWORD, 10)

    // Tenants
    const dokRes = await client.query(
      `INSERT INTO tenants (name, subdomain, plan, status, user_limit, owner_email)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['DOK Test', 'dok-test', 'starter', 'active', 10, 'dok-test@test.com']
    )
    const atlRes = await client.query(
      `INSERT INTO tenants (name, subdomain, plan, status, user_limit, owner_email)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['ATL Test', 'atl-test', 'starter', 'active', 10, 'atl-test@test.com']
    )
    const dokId = dokRes.rows[0].id as string
    const atlId = atlRes.rows[0].id as string

    // Users — dok-test
    const dokAdminRes = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['dok-admin@test.com', 'dok-admin-test', 'DOK Admin', hash, 'admin', dokId]
    )
    const dokSalesRes = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['dok-sales@test.com', 'dok-sales-test', 'DOK Sales', hash, 'sales', dokId]
    )

    // Users — atl-test
    const atlAdminRes = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['atl-admin@test.com', 'atl-admin-test', 'ATL Admin', hash, 'admin', atlId]
    )
    const atlSalesRes = await client.query(
      `INSERT INTO users (email, username, display_name, password_hash, role, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['atl-sales@test.com', 'atl-sales-test', 'ATL Sales', hash, 'sales', atlId]
    )

    const dokAdminId = dokAdminRes.rows[0].id as string

    // Leads for dok-test (9 distinct solutions → produces "Others (2)" bucket)
    for (const solution of SOLUTIONS) {
      await client.query(
        `INSERT INTO leads
           (company_name, solution, contacts, sales_stage, estimated_revenue,
            probability, owner_id, owner_email, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          `${solution} Corp`, solution, '[]', 'Meeting Pending',
          100000, 50, dokAdminId, 'dok-admin@test.com', dokId,
        ]
      )
    }

    return {
      tenants: {
        dok: { id: dokId, subdomain: 'dok-test' },
        atl: { id: atlId, subdomain: 'atl-test' },
      },
      users: {
        dokAdmin: { id: dokAdminId,               email: 'dok-admin@test.com', username: 'dok-admin-test', password: PASSWORD },
        dokSales: { id: dokSalesRes.rows[0].id,   email: 'dok-sales@test.com', username: 'dok-sales-test', password: PASSWORD },
        atlAdmin: { id: atlAdminRes.rows[0].id,   email: 'atl-admin@test.com', username: 'atl-admin-test', password: PASSWORD },
        atlSales: { id: atlSalesRes.rows[0].id,   email: 'atl-sales@test.com', username: 'atl-sales-test', password: PASSWORD },
      },
    }
  } finally {
    await client.end()
  }
}

export async function teardownTestData(seedData: SeedData): Promise<void> {
  const client = getDbClient()
  await client.connect()
  try {
    await client.query(
      'DELETE FROM tenants WHERE id = ANY($1::uuid[])',
      [[seedData.tenants.dok.id, seedData.tenants.atl.id]]
    )
  } finally {
    await client.end()
  }
}
```

- [ ] **Step 2: Create `e2e/global-setup.ts`**

```typescript
import path from 'path'
import fs from 'fs'
import { seedTestData } from './helpers/seed'

export default async function globalSetup() {
  const seedData = await seedTestData()
  const outPath = path.join(process.cwd(), 'fixtures/seed-data.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(seedData, null, 2))
  console.log('✓ Test tenants seeded (dok-test, atl-test)')
}
```

- [ ] **Step 3: Create `e2e/global-teardown.ts`**

```typescript
import path from 'path'
import fs from 'fs'
import { teardownTestData, SeedData } from './helpers/seed'

export default async function globalTeardown() {
  const seedPath = path.join(process.cwd(), 'fixtures/seed-data.json')
  if (!fs.existsSync(seedPath)) return
  const seedData: SeedData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'))
  await teardownTestData(seedData)
  fs.unlinkSync(seedPath)
  console.log('✓ Test tenants removed')
}
```

- [ ] **Step 4: Verify seed runs correctly**

Make sure the backend DB is running, then from `e2e/`:

```bash
npx tsx -e "import('./helpers/seed').then(m => m.seedTestData()).then(d => { console.log(JSON.stringify(d, null, 2)); process.exit(0) }).catch(e => { console.error(e); process.exit(1) })"
```

Expected: JSON printed with two tenant IDs and four user IDs.

- [ ] **Step 5: Clean up the manual seed**

```bash
npx tsx -e "
import('./fixtures/index.js').catch(() => null)
const { teardownTestData } = await import('./helpers/seed.js')
// Replace <DOK_ID> and <ATL_ID> with IDs printed above
await teardownTestData({ tenants: { dok: { id: '<DOK_ID>', subdomain: 'dok-test' }, atl: { id: '<ATL_ID>', subdomain: 'atl-test' } }, users: {} as any })
console.log('cleaned')
process.exit(0)
"
```

Alternatively: run `DELETE FROM tenants WHERE subdomain IN ('dok-test','atl-test')` in psql.

- [ ] **Step 6: Commit**

```bash
cd ..
git add e2e/helpers/seed.ts e2e/global-setup.ts e2e/global-teardown.ts
git commit -m "feat(e2e): add seed helpers and global setup/teardown"
```

---

## Task 3: Playwright config, fixtures, and API helper

**Files:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/fixtures/index.ts`
- Create: `e2e/helpers/api.ts`

- [ ] **Step 1: Create `e2e/playwright.config.ts`**

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:        './tests',
  timeout:        30_000,
  fullyParallel:  false,
  forbidOnly:     !!process.env.CI,
  retries:        process.env.CI ? 1 : 0,
  reporter:       'html',
  globalSetup:    './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  use: {
    baseURL:          'http://localhost:3000',
    trace:            'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command:             'npm run dev',
      cwd:                 '../backend',
      port:                4000,
      reuseExistingServer: true,
      timeout:             30_000,
    },
    {
      command:             'npm run dev',
      cwd:                 '../frontend',
      port:                3000,
      reuseExistingServer: true,
      timeout:             60_000,
    },
  ],
})
```

- [ ] **Step 2: Create `e2e/fixtures/index.ts`**

```typescript
import { test as base, Page, BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import type { SeedData } from '../helpers/seed'

export { expect } from '@playwright/test'

export function loadSeedData(): SeedData {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'fixtures/seed-data.json'), 'utf-8')
  )
}

type Fixtures = {
  tenantPage:  (subdomain: string) => Promise<Page>
  authedPage:  (subdomain: string, email: string, password: string) => Promise<Page>
}

export const test = base.extend<Fixtures>({
  tenantPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async (subdomain) => {
      const ctx = await browser.newContext()
      contexts.push(ctx)
      const page = await ctx.newPage()
      await page.route('**/api/**', (route) =>
        route.continue({
          headers: { ...route.request().headers(), 'X-Tenant-Subdomain': subdomain },
        })
      )
      return page
    })
    for (const ctx of contexts) await ctx.close()
  },

  authedPage: async ({ browser }, use) => {
    const contexts: BrowserContext[] = []
    await use(async (subdomain, email, password) => {
      const ctx = await browser.newContext()
      contexts.push(ctx)
      const page = await ctx.newPage()
      await page.route('**/api/**', (route) =>
        route.continue({
          headers: { ...route.request().headers(), 'X-Tenant-Subdomain': subdomain },
        })
      )
      await page.goto('/login')
      await page.fill('#username', email)
      await page.fill('#password', password)
      await page.click('button[type="submit"]')
      await page.waitForURL('http://localhost:3000/')
      return page
    })
    for (const ctx of contexts) await ctx.close()
  },
})
```

- [ ] **Step 3: Create `e2e/helpers/api.ts`**

```typescript
const BASE = 'http://localhost:4000'

export async function apiLogin(
  email: string,
  password: string,
  subdomain: string,
): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Subdomain': subdomain },
    body:    JSON.stringify({ username: email, password }),
  })
  if (!res.ok) throw new Error(`Login failed ${res.status}: ${await res.text()}`)
  const cookie = res.headers.get('set-cookie') ?? ''
  const match  = cookie.match(/auth_token=([^;]+)/)
  if (!match) throw new Error('No auth_token in Set-Cookie header')
  return match[1]
}

export async function apiFetch(
  urlPath: string,
  token: string,
  subdomain: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${BASE}${urlPath}`, {
    ...options,
    headers: {
      'Content-Type':      'application/json',
      'Authorization':     `Bearer ${token}`,
      'X-Tenant-Subdomain': subdomain,
      ...(options.headers as Record<string, string> | undefined ?? {}),
    },
  })
}
```

- [ ] **Step 4: Verify config is valid**

```bash
cd e2e
npx playwright test --list
```

Expected: `No tests found` (no spec files yet) — but no config parse errors.

- [ ] **Step 5: Commit**

```bash
cd ..
git add e2e/playwright.config.ts e2e/fixtures/index.ts e2e/helpers/api.ts
git commit -m "feat(e2e): add playwright config, fixtures, and api helper"
```

---

## Task 4: Auth tests

**Files:**
- Create: `e2e/tests/auth.spec.ts`

> **Context:** Login page is at `/login`. Username input: `#username`. Password input: `#password`. Submit: `button[type="submit"]`. Error message renders in a `div` with class `text-red-500 bg-red-50`. On success the app redirects to `/`. Logout: click the user avatar button in the header (contains display name text "DOK Admin"), then click "Sign Out" in the dropdown.

- [ ] **Step 1: Create `e2e/tests/auth.spec.ts`**

```typescript
import { test, expect, loadSeedData } from '../fixtures'

test.describe('Authentication', () => {
  test('valid login on correct tenant redirects to dashboard', async ({ tenantPage }) => {
    const seed = loadSeedData()
    const page = await tenantPage('dok-test')
    await page.goto('/login')
    await page.fill('#username', seed.users.dokAdmin.email)
    await page.fill('#password', seed.users.dokAdmin.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/')
    await expect(page).toHaveURL('http://localhost:3000/')
  })

  test('invalid password shows error message', async ({ tenantPage }) => {
    const seed = loadSeedData()
    const page = await tenantPage('dok-test')
    await page.goto('/login')
    await page.fill('#username', seed.users.dokAdmin.email)
    await page.fill('#password', 'WrongPassword!')
    await page.click('button[type="submit"]')
    await expect(page.locator('div.text-red-500').first()).toBeVisible()
    await expect(page).toHaveURL('http://localhost:3000/login')
  })

  test('dok credentials blocked on atl subdomain', async ({ tenantPage }) => {
    const seed = loadSeedData()
    const page = await tenantPage('atl-test')
    await page.goto('/login')
    await page.fill('#username', seed.users.dokAdmin.email)
    await page.fill('#password', seed.users.dokAdmin.password)
    await page.click('button[type="submit"]')
    await expect(page.locator('div.text-red-500').first()).toBeVisible()
    await expect(page).toHaveURL('http://localhost:3000/login')
  })

  test('atl credentials blocked on dok subdomain', async ({ tenantPage }) => {
    const seed = loadSeedData()
    const page = await tenantPage('dok-test')
    await page.goto('/login')
    await page.fill('#username', seed.users.atlAdmin.email)
    await page.fill('#password', seed.users.atlAdmin.password)
    await page.click('button[type="submit"]')
    await expect(page.locator('div.text-red-500').first()).toBeVisible()
    await expect(page).toHaveURL('http://localhost:3000/login')
  })

  test('logout clears session and redirects to login', async ({ authedPage }) => {
    const seed = loadSeedData()
    const page = await authedPage('dok-test', seed.users.dokAdmin.email, seed.users.dokAdmin.password)
    // Open user dropdown — trigger button shows display name "DOK Admin"
    await page.getByRole('button', { name: /DOK Admin/i }).click()
    await page.getByText('Sign Out').click()
    await page.waitForURL('http://localhost:3000/login')
    await expect(page).toHaveURL('http://localhost:3000/login')
  })
})
```

- [ ] **Step 2: Run auth tests**

```bash
cd e2e
npx playwright test tests/auth.spec.ts --reporter=line
```

Expected: `5 passed`

- [ ] **Step 3: If any test fails, view the HTML report**

```bash
npx playwright show-report
```

Open the URL shown (usually `http://localhost:9323`) to see screenshots and traces.

- [ ] **Step 4: Commit**

```bash
cd ..
git add e2e/tests/auth.spec.ts
git commit -m "test(e2e): add auth tests — login flows and cross-tenant blocking"
```

---

## Task 5: Settings security tests

**Files:**
- Create: `e2e/tests/settings.spec.ts`

> **Context:** Settings endpoint is `GET /api/settings/:userId`. Auth uses Bearer token (`Authorization: Bearer <token>`). The `assertTenantOwnership` guard in `settingsController.ts` returns 403 when: (a) a sales user requests another user's settings, or (b) any user requests settings for a userId that doesn't belong to their tenant. Backend is on port 4000. These tests use `apiLogin` + `apiFetch` directly — no browser.

- [ ] **Step 1: Create `e2e/tests/settings.spec.ts`**

```typescript
import { test, expect, loadSeedData } from '../fixtures'
import { apiLogin, apiFetch } from '../helpers/api'

test.describe('Settings security', () => {
  test('admin reads own settings — 200', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokAdmin.email, seed.users.dokAdmin.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.dokAdmin.id}`, token, 'dok-test')
    expect(res.status).toBe(200)
  })

  test('admin reads same-tenant sales user settings — 200', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokAdmin.email, seed.users.dokAdmin.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.dokSales.id}`, token, 'dok-test')
    expect(res.status).toBe(200)
  })

  test('admin reads cross-tenant user settings — 403', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokAdmin.email, seed.users.dokAdmin.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.atlAdmin.id}`, token, 'dok-test')
    expect(res.status).toBe(403)
  })

  test('sales user reads own settings — 200', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokSales.email, seed.users.dokSales.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.dokSales.id}`, token, 'dok-test')
    expect(res.status).toBe(200)
  })

  test('sales user reads another user settings — 403', async () => {
    const seed = loadSeedData()
    const token = await apiLogin(seed.users.dokSales.email, seed.users.dokSales.password, 'dok-test')
    const res = await apiFetch(`/api/settings/${seed.users.dokAdmin.id}`, token, 'dok-test')
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run settings tests**

```bash
cd e2e
npx playwright test tests/settings.spec.ts --reporter=line
```

Expected: `5 passed`

- [ ] **Step 3: Commit**

```bash
cd ..
git add e2e/tests/settings.spec.ts
git commit -m "test(e2e): add settings security tests — cross-tenant 403 enforcement"
```

---

## Task 6: Analytics drill-down tests

**Files:**
- Create: `e2e/tests/analytics.spec.ts`

> **Context:** Analytics page is at `/analytics`. The `SolutionPieChart` renders a custom legend — each legend row is a `div` containing a `p.text-xs.font-medium.text-gray-900` with the solution name as text. Clicking a legend row triggers `onSliceClick`. The `SolutionLeadsSheet` renders a shadcn `Sheet` — when open, `SheetTitle` contains the solution name and `SheetDescription` shows lead count + total. The seeded leads have 9 distinct solutions; `processChartData(data, 8)` produces top 7 named slices + `Others (2)`. The close button on the sheet is the shadcn default `X` button with `aria-label="Close"`. Tests use `authedPage` logged in as dok-admin on dok-test subdomain.

- [ ] **Step 1: Create `e2e/tests/analytics.spec.ts`**

```typescript
import { test, expect, loadSeedData } from '../fixtures'

test.describe('Analytics drill-down', () => {
  test('clicking a legend row opens the leads sheet with matching title', async ({ authedPage }) => {
    const seed = loadSeedData()
    const page = await authedPage('dok-test', seed.users.dokAdmin.email, seed.users.dokAdmin.password)
    await page.goto('/analytics')

    // Click the first named solution in the custom legend
    const firstLegendItem = page.locator('p.text-xs.font-medium.text-gray-900').first()
    const solutionName = await firstLegendItem.textContent()
    await firstLegendItem.click()

    // Sheet should be visible with matching title
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('[role="dialog"] [data-slot="sheet-title"]')).toHaveText(solutionName!)
  })

  test('sheet description shows correct lead count', async ({ authedPage }) => {
    const seed = loadSeedData()
    const page = await authedPage('dok-test', seed.users.dokAdmin.email, seed.users.dokAdmin.password)
    await page.goto('/analytics')

    await page.locator('p.text-xs.font-medium.text-gray-900').first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    // Each seeded solution has exactly 1 lead
    const description = page.locator('[role="dialog"] [data-slot="sheet-description"]')
    await expect(description).toContainText('1 lead')
  })

  test('clicking Others opens sheet with grouped leads', async ({ authedPage }) => {
    const seed = loadSeedData()
    const page = await authedPage('dok-test', seed.users.dokAdmin.email, seed.users.dokAdmin.password)
    await page.goto('/analytics')

    // "Others (2)" legend item — seeded 9 solutions, top 7 named + 2 in Others
    const othersItem = page.locator('p.text-xs.font-medium.text-gray-900', { hasText: /^Others \(\d+\)$/ })
    await expect(othersItem).toBeVisible()
    await othersItem.click()

    await expect(page.locator('[role="dialog"]')).toBeVisible()
    await expect(page.locator('[role="dialog"] [data-slot="sheet-title"]')).toContainText('Others')

    // Should show 2 leads (the 2 that didn't make top 7)
    const description = page.locator('[role="dialog"] [data-slot="sheet-description"]')
    await expect(description).toContainText('2 leads')
  })

  test('closing the sheet hides it', async ({ authedPage }) => {
    const seed = loadSeedData()
    const page = await authedPage('dok-test', seed.users.dokAdmin.email, seed.users.dokAdmin.password)
    await page.goto('/analytics')

    await page.locator('p.text-xs.font-medium.text-gray-900').first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('can open a different slice after closing', async ({ authedPage }) => {
    const seed = loadSeedData()
    const page = await authedPage('dok-test', seed.users.dokAdmin.email, seed.users.dokAdmin.password)
    await page.goto('/analytics')

    const items = page.locator('p.text-xs.font-medium.text-gray-900')

    // Open first
    const first = await items.nth(0).textContent()
    await items.nth(0).click()
    await expect(page.locator('[role="dialog"] [data-slot="sheet-title"]')).toHaveText(first!)

    // Close
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()

    // Open second
    const second = await items.nth(1).textContent()
    await items.nth(1).click()
    await expect(page.locator('[role="dialog"] [data-slot="sheet-title"]')).toHaveText(second!)
  })
})
```

- [ ] **Step 2: Run analytics tests**

```bash
cd e2e
npx playwright test tests/analytics.spec.ts --reporter=line
```

Expected: `5 passed`

- [ ] **Step 3: Commit**

```bash
cd ..
git add e2e/tests/analytics.spec.ts
git commit -m "test(e2e): add analytics drill-down tests"
```

---

## Task 7: Full suite run and HTML report

- [ ] **Step 1: Run all tests**

```bash
cd e2e
npx playwright test --reporter=line
```

Expected: `15 passed` (5 auth + 5 settings + 5 analytics)

- [ ] **Step 2: Open HTML report**

```bash
npx playwright show-report
```

Open the URL shown (usually `http://localhost:9323`). Verify all 15 tests show green.

- [ ] **Step 3: Final commit**

```bash
cd ..
git add -A
git commit -m "test(e2e): complete Playwright E2E suite — 15 tests passing"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Section 1 (Seed): Tasks 2 covers `seedTestData`, `teardownTestData`, leads seeded for analytics
- ✅ Section 2 (Fixtures): Task 3 covers `tenantPage`, `authedPage`, `apiFetch`, header injection
- ✅ Section 3 (Tests): Tasks 4–6 cover all 15 tests from the spec tables
- ✅ Section 4 (Config): Task 3 covers `playwright.config.ts`, `webServer`, scripts, `.gitignore`

**No placeholders:** All steps have complete code. All commands have expected output.

**Type consistency:** `SeedData` interface defined once in `helpers/seed.ts`, imported by `fixtures/index.ts`, `global-setup.ts`, and `global-teardown.ts`. `apiLogin` returns `string` (token); `apiFetch` accepts `string` token — consistent across Task 3 and Task 5.
