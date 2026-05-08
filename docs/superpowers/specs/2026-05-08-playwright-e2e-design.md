# Playwright E2E Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a self-contained Playwright E2E test suite at the project root that verifies login flows, cross-tenant security isolation, and the analytics drill-down UI — using header injection to simulate multi-tenant subdomain routing locally.

**Architecture:** A standalone `e2e/` package at the project root with its own `package.json`. A `global-setup` script seeds two isolated test tenants into the local PostgreSQL DB before any tests run; `global-teardown` deletes them after. A Playwright fixture wraps every test page to inject `X-Tenant-Subdomain` headers on all `/api/` requests, simulating nginx's subdomain routing in local dev.

**Tech Stack:** Playwright, TypeScript, `pg` (direct DB access for seed/teardown), `bcryptjs` (password hashing in seed), `dotenv` (read `backend/.env` for DB credentials)

---

## Structure

```
e2e/
├── package.json
├── tsconfig.json
├── playwright.config.ts
├── global-setup.ts
├── global-teardown.ts
├── fixtures/
│   ├── index.ts              # custom `test` with authed page + header injection
│   └── seed-data.json        # written by global-setup, git-ignored
├── helpers/
│   ├── api.ts                # raw fetch helpers for API-level assertions
│   └── seed.ts               # DB seed/teardown logic
└── tests/
    ├── auth.spec.ts
    ├── settings.spec.ts
    └── analytics.spec.ts
```

---

## Section 1: Seed & Teardown

`global-setup.ts` reads `DATABASE_URL` from `../backend/.env` and connects via `pg`. It inserts:

**Tenants:**
```json
[
  { "name": "DOK Test",  "subdomain": "dok-test", "status": "active", "plan": "pro" },
  { "name": "ATL Test",  "subdomain": "atl-test", "status": "active", "plan": "pro" }
]
```

**Users (one admin + one sales per tenant):**
```
dok-test:  dok-admin@test.com / TestPass@123 (role: admin)
           dok-sales@test.com / TestPass@123 (role: sales)
atl-test:  atl-admin@test.com / TestPass@123 (role: admin)
           atl-sales@test.com / TestPass@123 (role: sales)
```

Passwords are bcrypt-hashed (rounds: 10) before insertion. All generated UUIDs and credentials are written to `e2e/fixtures/seed-data.json` (git-ignored) for use by tests.

`global-teardown.ts` deletes both tenants by ID. `ON DELETE CASCADE` on the `users`, `dashboard_settings`, `leads`, and `notifications` tables cleans all dependent rows automatically.

**DB connection:** reads `DATABASE_URL` or constructs from `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` in `../backend/.env`.

---

## Section 2: Fixtures & Header Injection

`e2e/fixtures/index.ts` exports a custom `test` object that extends Playwright's base `test` with two fixtures:

**`tenantPage`** — accepts a `subdomain` string, returns a `Page` with a `page.route('**/api/**', ...)` intercept that adds `X-Tenant-Subdomain: <subdomain>` to every matched request. This simulates nginx's subdomain header for local dev.

**`authedPage`** — wraps `tenantPage`, performs a programmatic login via `request.post('/api/auth/login')` and stores the returned `auth_token` cookie on the page context before any test step runs.

`e2e/helpers/api.ts` exports a `apiFetch(path, options, subdomain)` function that makes raw `fetch` calls with the `X-Tenant-Subdomain` header set — used by `settings.spec.ts` which tests the API directly without a browser.

---

## Section 3: Test Coverage

### `tests/auth.spec.ts`

Uses `tenantPage` fixture (no pre-auth). All tests navigate to `http://localhost:3000/login`.

| Test | Action | Expected |
|------|--------|----------|
| Valid login — correct tenant | POST login with dok-admin on dok-test subdomain | 200, cookie set, redirected to dashboard |
| Invalid password | POST login with wrong password | 401, error message visible on page |
| Cross-tenant blocked (dok→atl) | dok-admin credentials on atl-test subdomain | 401, error message shown |
| Cross-tenant blocked (atl→dok) | atl-admin credentials on dok-test subdomain | 401, error message shown |
| Logout | Login then click logout | Cookie cleared, redirected to `/login` |

### `tests/settings.spec.ts`

API-level only — uses `apiFetch` helper directly (no browser). Generates fresh JWTs via `POST /api/auth/login` for each actor.

| Test | Actor | Target userId | Expected |
|------|-------|---------------|----------|
| Own settings | dok-admin | dok-admin's id | 200 |
| Same-tenant other user | dok-admin | dok-sales's id | 200 |
| Cross-tenant user | dok-admin | atl-admin's id | 403 |
| Own settings | dok-sales | dok-sales's id | 200 |
| Other user (sales role) | dok-sales | dok-admin's id | 403 |

### `tests/analytics.spec.ts`

Browser tests — uses `authedPage` fixture (logged in as dok-admin). Navigates to `http://localhost:3000/analytics`.

| Test | Action | Expected |
|------|--------|----------|
| Slice click opens sheet | Click a named pie slice | `SolutionLeadsSheet` visible, title matches solution |
| Sheet shows correct leads | Click slice | Lead rows shown match that solution |
| Others bucket | Click "Others (N)" slice | Sheet opens, leads shown are not in top-7 solutions |
| Sheet closes | Click close button | Sheet hidden, `selectedSolution` reset |
| Re-open after close | Close then click different slice | Sheet opens with new solution title |

---

## Section 4: Configuration

**`playwright.config.ts`:**
- `baseURL`: `http://localhost:3000`
- `globalSetup`: `./global-setup.ts`
- `globalTeardown`: `./global-teardown.ts`
- `webServer`: starts `npm run dev` in `../frontend` and `npm run dev` in `../backend` if not already running
- `projects`: one Chromium project (no need for multi-browser for security/integration tests)
- `testDir`: `./tests`
- `timeout`: 30 000ms per test
- `reporter`: `html` (generates viewable report)

**`e2e/package.json` scripts:**
```json
{
  "test": "playwright test",
  "test:report": "playwright show-report",
  "test:ui": "playwright test --ui"
}
```

**`.gitignore` additions in `e2e/`:**
```
node_modules/
fixtures/seed-data.json
playwright-report/
test-results/
```

---

## Prerequisites

Before running:
1. Local PostgreSQL running with the backend DB migrated (`npm run migrate` in `backend/`)
2. `backend/.env` present with valid DB credentials
3. Frontend and backend dev servers either already running on `:3000`/`:4000`, or Playwright's `webServer` config will start them automatically

Run:
```bash
cd e2e
npm install
npm test
```
