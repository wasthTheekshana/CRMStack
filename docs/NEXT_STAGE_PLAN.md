# DOK CRM — Next Stage Commercial Plan

> **Document Purpose:** Complete technical and commercial roadmap from the current
> working local system to a fully deployable, multi-tenant, commercially sellable SaaS product.
>
> **Current Date:** April 2026
> **Current State:** PostgreSQL + JWT auth + MVC architecture running locally on Docker.
> Firebase fully removed. Frontend and backend separated.

---

## Table of Contents

1. [Current System State](#1-current-system-state)
2. [What Needs to Be Built](#2-what-needs-to-be-built)
3. [Phase 1 — Multi-Tenant Architecture](#3-phase-1--multi-tenant-architecture)
4. [Phase 2 — Per-Tenant Customization](#4-phase-2--per-tenant-customization)
5. [Phase 3 — Super Admin Panel](#5-phase-3--super-admin-panel)
6. [Phase 4 — License Enforcement](#6-phase-4--license-enforcement)
7. [Phase 5 — Password Reset & Email Service](#7-phase-5--password-reset--email-service)
8. [Phase 6 — Cloud Deployment](#8-phase-6--cloud-deployment)
9. [Phase 7 — Post-Launch Features](#9-phase-7--post-launch-features)
10. [Phase 8 — Future Growth](#10-phase-8--future-growth)
11. [Pricing Model](#11-pricing-model)
12. [Full Build Order & Timeline](#12-full-build-order--timeline)
13. [Commercial Readiness Checklist](#13-commercial-readiness-checklist)

---

## 1. Current System State

### ✅ Already Completed

| Area | Detail |
|------|--------|
| Core CRM | Pipeline, kanban board, lead CRUD, deal modal |
| Role-based access | Admin sees all data, sales sees own data only |
| Analytics & reports | KPI cards, charts, rep comparison, revenue forecast |
| Sales targets | Monthly targets, achievement tracking |
| Soft delete | Deleted leads page, restore functionality |
| Database | PostgreSQL 15 via Docker locally |
| Authentication | Custom JWT (no Firebase dependency) |
| Backend architecture | Express + MVC (models / controllers / routes) |
| Frontend architecture | React 18 + TypeScript + Vite, services / models / utils split |
| Firebase removed | All Firebase SDK, files, and dependencies deleted |
| Folder structure | `frontend/` and `backend/` fully separated |

### ❌ Not Yet Built (Required for Commercial)

| Area | Priority |
|------|---------|
| Multi-tenant architecture | 🔴 Blocker |
| Per-tenant customization (stages, fields) | 🔴 Blocker |
| Super admin panel (DOK internal) | 🔴 Blocker |
| License / user limit enforcement | 🔴 Blocker |
| Self-service password reset | 🔴 Blocker |
| Cloud server deployment + SSL | 🔴 Blocker |
| Email notifications | 🟡 Important |
| CSV bulk lead import | 🟡 Important |
| Activity log per lead | 🟡 Important |
| Audit log (admin) | 🟡 Important |
| 2FA | 🟢 Future |
| REST API access | 🟢 Future |
| White-label / custom branding | 🟢 Future |

---

## 2. What Needs to Be Built

### The Core Problem with Current Architecture

Everything is single-tenant and hardcoded:

```typescript
// frontend/src/config/constants.ts — currently hardcoded
export const SALES_STAGES = [
  { id: 'On Hold',         probability: 10 },
  { id: 'Meeting Pending', probability: 25 },
  { id: 'Proposal Sent',   probability: 50 },
  { id: 'Negotiated',      probability: 75 },
  { id: 'Verbal Yes',      probability: 90 },
  { id: 'Closed & Won',    probability: 100 },
]

export const SOLUTIONS = [
  'Document Management',
  'Digital Archiving',
  'Workflow Automation',
  ...
]
```

```sql
-- backend/migrations/002_create_leads.sql — stage names hardcoded in DB constraint
sales_stage CHECK (sales_stage IN (
  'On Hold', 'Meeting Pending', 'Proposal Sent',
  'Negotiated', 'Verbal Yes', 'Closed & Won'
))
```

**Every customer needs different stages, different products, different fields.**
A real estate company needs `Site Visit → Valuation → Offer → Sold`.
A logistics company needs `Inquiry → Quote → Negotiation → Contract Signed`.

The solution is a **Tenant Configuration system** — every customizable element
is stored per-tenant in the database and loaded at login.

---

## 3. Phase 1 — Multi-Tenant Architecture

> **Goal:** One codebase, one server, completely isolated data per customer.
>
> **Estimated build time:** 2–3 weeks

### 3.1 New Database Tables

#### `tenants` — One row per customer company

```sql
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,           -- "Acme Corp"
  subdomain     VARCHAR(100) NOT NULL UNIQUE,    -- "acme" → acme.dokcrm.com
  plan          VARCHAR(20)  NOT NULL DEFAULT 'starter'
                    CHECK (plan IN ('starter', 'business', 'enterprise')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'cancelled')),
  user_limit    INTEGER NOT NULL DEFAULT 3,       -- based on plan
  owner_email   VARCHAR(255) NOT NULL,            -- billing contact
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at  TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status    ON tenants(status);
```

#### Add `tenant_id` to all existing tables

```sql
-- Users belong to a tenant
ALTER TABLE users
  ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Leads belong to a tenant
ALTER TABLE leads
  ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN custom_fields JSONB DEFAULT '{}';   -- for custom field values

CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);

-- Tasks belong to a tenant
ALTER TABLE tasks
  ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Activities belong to a tenant
ALTER TABLE activities
  ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Sales targets belong to a tenant
ALTER TABLE sales_targets
  ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Dashboard settings belong to a tenant user
ALTER TABLE dashboard_settings
  ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
```

> **Why not separate schemas per tenant?**
> Schema-per-tenant (PostgreSQL schemas) requires dynamic connection strings and
> makes cross-tenant reporting impossible. Row-level isolation with `tenant_id`
> is simpler, faster to build, and proven at scale (used by Basecamp, GitHub, etc.)

### 3.2 JWT Token Changes

The JWT token must carry the tenant context so every API call knows which
tenant's data to query.

**Current JWT payload:**
```typescript
{ userId: string, role: 'admin' | 'sales', email: string }
```

**New JWT payload:**
```typescript
{
  userId:   string,
  tenantId: string,         // ← new
  role:     'admin' | 'sales',
  email:    string,
  plan:     string          // ← new (for license checks)
}
```

### 3.3 Backend Middleware Changes

#### `backend/src/middleware/auth.ts` — add tenantId

```typescript
export interface AuthPayload {
  userId:   string
  tenantId: string    // ← add
  role:     'admin' | 'sales'
  email:    string
  plan:     string    // ← add
}
```

#### New middleware: `backend/src/middleware/tenantFilter.ts`

Every DB query must automatically filter by `tenant_id`. This middleware
attaches a helper to `req` so controllers never forget to filter:

```typescript
// Automatically applies tenant_id to all queries
export function withTenant(req: Request) {
  return req.user!.tenantId
}
```

### 3.4 Backend Controller Changes

Every controller that queries the database must add `tenant_id` to the WHERE clause.

**Before (single-tenant):**
```typescript
// leadController.ts
export async function listLeads(req, res) {
  const leads = await findAllLeads(req.user!.userId, isAdmin)
  res.json(leads)
}
```

**After (multi-tenant):**
```typescript
// leadController.ts
export async function listLeads(req, res) {
  const leads = await findAllLeads(
    req.user!.userId,
    req.user!.tenantId,   // ← every query now scoped to tenant
    isAdmin
  )
  res.json(leads)
}
```

**Before (model — no tenant filter):**
```typescript
// leadModel.ts
export async function findAllLeads(userId: string, isAdmin: boolean) {
  const result = isAdmin
    ? await query('SELECT * FROM leads WHERE is_deleted = FALSE')
    : await query('SELECT * FROM leads WHERE is_deleted = FALSE AND owner_id = $1', [userId])
```

**After (model — tenant isolated):**
```typescript
// leadModel.ts
export async function findAllLeads(userId: string, tenantId: string, isAdmin: boolean) {
  const result = isAdmin
    ? await query(
        'SELECT * FROM leads WHERE is_deleted = FALSE AND tenant_id = $1',
        [tenantId]
      )
    : await query(
        'SELECT * FROM leads WHERE is_deleted = FALSE AND tenant_id = $1 AND owner_id = $2',
        [tenantId, userId]
      )
```

> This same pattern applies to all models: `userModel`, `taskModel`,
> `activityModel`, `salesTargetModel`, `settingsModel`.

### 3.5 Subdomain Routing

Each tenant gets their own subdomain: `acme.dokcrm.com`, `xltech.dokcrm.com`.

**Nginx config (wildcard):**
```nginx
server {
  listen 443 ssl;
  server_name *.dokcrm.com;

  # Extract subdomain and pass to backend
  location / {
    proxy_pass         http://app:4000;
    proxy_set_header   X-Tenant-Subdomain $subdomain;
    proxy_set_header   Host $host;
  }
}
```

**Backend subdomain resolver:**
```typescript
// backend/src/middleware/tenantResolver.ts
// Reads X-Tenant-Subdomain header → looks up tenant in DB → attaches to req
export async function resolveTenant(req, res, next) {
  const subdomain = req.headers['x-tenant-subdomain'] as string
  const tenant = await findTenantBySubdomain(subdomain)
  if (!tenant || tenant.status !== 'active') {
    res.status(404).json({ error: 'Tenant not found or suspended' })
    return
  }
  req.tenant = tenant
  next()
}
```

### 3.6 Files to Create / Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/migrations/008_add_tenant_id.sql` | Create | Add tenant_id to all tables |
| `backend/migrations/009_create_tenants.sql` | Create | tenants table |
| `backend/src/models/tenantModel.ts` | Create | findBySubdomain, findById, create, update |
| `backend/src/middleware/tenantResolver.ts` | Create | Subdomain → tenant lookup |
| `backend/src/middleware/auth.ts` | Modify | Add tenantId + plan to JWT payload |
| `backend/src/controllers/*` | Modify | Pass tenantId to all model calls |
| `backend/src/models/*` | Modify | Add tenant_id to all WHERE clauses |
| `frontend/src/store/authStore.ts` | Modify | Store tenantId in auth state |

---

## 4. Phase 2 — Per-Tenant Customization

> **Goal:** Each customer configures their own pipeline stages, products,
> lead fields, and branding without any code changes.
>
> **Estimated build time:** 2 weeks

### 4.1 Database Table

```sql
CREATE TABLE tenant_configs (
  tenant_id       UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  -- Pipeline stage definitions
  sales_stages    JSONB NOT NULL DEFAULT '[]',

  -- Product / solution categories
  solutions       JSONB NOT NULL DEFAULT '[]',

  -- Admin-defined extra lead fields
  custom_fields   JSONB NOT NULL DEFAULT '[]',

  -- Show/hide standard lead fields
  visible_fields  JSONB NOT NULL DEFAULT '{}',

  -- Company branding
  branding        JSONB NOT NULL DEFAULT '{}',

  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Config JSON Structures

#### `sales_stages` — fully customizable pipeline

```json
[
  {
    "id":          "s1",
    "name":        "Meeting Pending",
    "color":       "#3B82F6",
    "probability": 25,
    "order":       1,
    "isWon":       false
  },
  {
    "id":          "s2",
    "name":        "Proposal Sent",
    "color":       "#F59E0B",
    "probability": 50,
    "order":       2,
    "isWon":       false
  },
  {
    "id":          "s3",
    "name":        "Closed & Won",
    "color":       "#22C55E",
    "probability": 100,
    "order":       3,
    "isWon":       true
  }
]
```

> `isWon: true` marks the stage that counts as a closed deal in KPI calculations.
> Every tenant must have exactly one `isWon: true` stage.

#### `solutions` — product/service categories

```json
[
  { "id": "p1", "name": "Digital Archiving" },
  { "id": "p2", "name": "Document Management" },
  { "id": "p3", "name": "Workflow Automation" }
]
```

#### `custom_fields` — extra lead fields admin adds

```json
[
  {
    "id":       "cf1",
    "name":     "Region",
    "type":     "select",
    "required": true,
    "options":  ["North", "South", "East", "West"]
  },
  {
    "id":       "cf2",
    "name":     "Budget (USD)",
    "type":     "number",
    "required": false,
    "options":  []
  },
  {
    "id":       "cf3",
    "name":     "Lead Source",
    "type":     "select",
    "required": false,
    "options":  ["Referral", "Cold Call", "Website", "Exhibition", "Social Media"]
  },
  {
    "id":       "cf4",
    "name":     "Follow-up Date",
    "type":     "date",
    "required": false,
    "options":  []
  },
  {
    "id":       "cf5",
    "name":     "Internal Notes",
    "type":     "text",
    "required": false,
    "options":  []
  }
]
```

> Supported field types: `text`, `number`, `select`, `date`, `checkbox`

#### `visible_fields` — hide standard fields the tenant doesn't use

```json
{
  "imageCount":  false,
  "boxCount":    false,
  "hoUpdate":    true,
  "probability": true,
  "remarks":     true
}
```

#### `branding` — company identity

```json
{
  "companyName":  "Acme Corp",
  "logoUrl":      "https://storage.dokcrm.com/tenants/acme/logo.png",
  "primaryColor": "#1E40AF",
  "faviconUrl":   "https://storage.dokcrm.com/tenants/acme/favicon.ico"
}
```

### 4.3 Custom Field Values on Leads

Standard field values go in their own DB columns.
Custom field values go in the `custom_fields` JSONB column added to leads:

```json
// leads row — custom_fields column
{
  "cf1": "North",
  "cf2": 45000,
  "cf3": "Referral",
  "cf4": "2026-05-01",
  "cf5": "Needs board approval before signing"
}
```

### 4.4 DB Constraint Change — Remove Hardcoded Stage Names

The current leads table has a hardcoded CHECK constraint on `sales_stage`.
This must be removed so tenants can use their own stage names:

```sql
-- migration: remove hardcoded stage CHECK constraint
ALTER TABLE leads DROP CONSTRAINT leads_sales_stage_check;
-- Stage validity is now enforced at the application level, not DB level
```

### 4.5 Frontend — Tenant Config Store

```typescript
// frontend/src/store/tenantStore.ts
interface TenantConfig {
  salesStages:   SalesStageConfig[]
  solutions:     SolutionConfig[]
  customFields:  CustomFieldConfig[]
  visibleFields: Record<string, boolean>
  branding:      BrandingConfig
}

interface SalesStageConfig {
  id:          string
  name:        string
  color:       string
  probability: number
  order:       number
  isWon:       boolean
}
```

Loaded at login via `GET /api/tenant/config` and stored in Zustand.
All components that currently import from `constants.ts` will instead
read from `useTenantStore()`.

### 4.6 Frontend — Replace Hardcoded Constants

**Current (hardcoded — in 15+ components):**
```typescript
import { SALES_STAGES, SOLUTIONS, getDefaultProbability } from '@/config/constants'
```

**New (tenant-aware):**
```typescript
import { useTenantStore } from '@/store/tenantStore'
const { salesStages, solutions } = useTenantStore()
```

### 4.7 Admin Workspace Settings Page

A new **"Workspace Settings"** page accessible only to tenant admins with four tabs:

```
/settings/workspace
├── Pipeline Tab
│   ├── Drag-and-drop stage reordering
│   ├── Add new stage (name, color picker, default probability)
│   ├── Edit existing stage
│   ├── Delete stage (with confirmation if leads exist in it)
│   └── Mark one stage as "Won" stage
│
├── Products Tab
│   ├── Add / edit / delete solution categories
│   └── Reorder with drag and drop
│
├── Lead Fields Tab
│   ├── Toggle visibility of standard fields (imageCount, boxCount, etc.)
│   ├── Add custom fields
│   │   ├── Field name
│   │   ├── Field type (text / number / select / date / checkbox)
│   │   ├── Required toggle
│   │   └── Options (for select type)
│   ├── Edit / delete custom fields
│   └── Reorder custom fields
│
└── Branding Tab
    ├── Upload company logo
    ├── Company display name
    ├── Primary color picker
    └── Preview of how it looks in the app
```

### 4.8 Files to Create / Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/migrations/010_create_tenant_configs.sql` | Create | tenant_configs table + remove hardcoded CHECK |
| `backend/src/models/tenantConfigModel.ts` | Create | findByTenantId, upsert |
| `backend/src/controllers/tenantConfigController.ts` | Create | getConfig, updateConfig |
| `backend/src/routes/tenantConfig.ts` | Create | GET/PUT `/api/tenant/config` |
| `frontend/src/store/tenantStore.ts` | Create | Zustand store for tenant config |
| `frontend/src/services/tenantService.ts` | Create | fetchTenantConfig, updateTenantConfig |
| `frontend/src/pages/admin/WorkspaceSettings.tsx` | Create | 4-tab settings page |
| `frontend/src/components/settings/PipelineSettings.tsx` | Create | Stage management UI |
| `frontend/src/components/settings/ProductSettings.tsx` | Create | Solutions management UI |
| `frontend/src/components/settings/LeadFieldSettings.tsx` | Create | Custom fields UI |
| `frontend/src/components/settings/BrandingSettings.tsx` | Create | Branding UI |
| `frontend/src/components/kanban/DealModal.tsx` | Modify | Render custom fields dynamically |
| `frontend/src/components/leads/LeadForm.tsx` | Modify | Render custom fields dynamically |
| `frontend/src/config/constants.ts` | Modify | Keep as defaults/fallback only |
| All components using `SALES_STAGES` | Modify | Switch to `useTenantStore()` |

---

## 5. Phase 3 — Super Admin Panel

> **Goal:** DOK internal team can manage all client companies from one place.
>
> **URL:** `admin.dokcrm.com` (separate from tenant subdomains)
>
> **Estimated build time:** 1.5 weeks

### 5.1 Super Admin Role

A new role `superadmin` exists only in a special `dok_admins` table.
Super admins are DOK employees — they are NOT part of any tenant's user table.

```sql
CREATE TABLE dok_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) NOT NULL UNIQUE,
  display_name  VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

Super admin JWT:
```typescript
{ adminId: string, role: 'superadmin', email: string }
```

### 5.2 Super Admin Dashboard Features

```
admin.dokcrm.com
├── Dashboard
│   ├── Total tenants (active / suspended / trial)
│   ├── Total users across all tenants
│   ├── New sign-ups this month
│   └── Revenue summary by plan
│
├── Tenants
│   ├── List all tenants (name, subdomain, plan, users, status, created date)
│   ├── Create new tenant
│   │   ├── Company name + subdomain
│   │   ├── Plan selection
│   │   ├── Admin email (sends welcome email)
│   │   └── Trial period (optional)
│   ├── View tenant details
│   │   ├── User list with last login dates
│   │   ├── Lead count, activity count
│   │   └── Current config (stages, solutions)
│   ├── Edit tenant (plan, user limit, status)
│   ├── Suspend tenant (all logins blocked immediately)
│   └── Delete tenant + export their data as CSV
│
├── Users (cross-tenant)
│   ├── Search any user by email across all tenants
│   └── Reset any user's password
│
└── System
    ├── Server health (CPU, memory, disk)
    └── Recent error logs
```

### 5.3 Files to Create

| File | Action | Description |
|------|--------|-------------|
| `backend/migrations/011_create_dok_admins.sql` | Create | dok_admins table |
| `backend/src/models/dokAdminModel.ts` | Create | Super admin auth queries |
| `backend/src/controllers/superAdminController.ts` | Create | Tenant CRUD, user management |
| `backend/src/routes/superAdmin.ts` | Create | All `/api/super-admin/*` endpoints |
| `backend/src/middleware/superAdminAuth.ts` | Create | Separate JWT verification for super admin |
| `frontend/src/pages/superadmin/` | Create | Full super admin UI (separate from main app) |

---

## 6. Phase 4 — License Enforcement

> **Goal:** Enforce user limits per plan. Prevent over-usage without payment.
>
> **Estimated build time:** 3–4 days

### 6.1 Plan Limits

| Plan | User Limit | Monthly Price |
|------|-----------|--------------|
| Starter | 3 users | LKR 32,000 / USD 99 |
| Business | 10 users | LKR 80,000 / USD 249 |
| Enterprise | Unlimited | LKR 195,000 / USD 599 |
| Extra user (Starter) | +1 | LKR 7,500 / USD 25 |
| Extra user (Business) | +1 | LKR 6,500 / USD 20 |

### 6.2 Enforcement Logic

Add to `POST /api/users` (create user):

```typescript
// backend/src/controllers/userController.ts
export async function createUserHandler(req, res) {
  const tenant = await findTenantById(req.user!.tenantId)
  const currentUserCount = await countActiveUsers(req.user!.tenantId)

  if (tenant.plan !== 'enterprise' && currentUserCount >= tenant.user_limit) {
    res.status(403).json({
      error: 'USER_LIMIT_REACHED',
      message: `Your ${tenant.plan} plan allows ${tenant.user_limit} users. ` +
               `Contact support to add more licences.`,
      currentCount: currentUserCount,
      limit: tenant.user_limit,
    })
    return
  }
  // ... proceed with creating user
}
```

Frontend shows a clear dialog when the limit is hit:
```
User Limit Reached
Your Business plan includes 10 users (currently 10/10).
To add more users, contact support to upgrade your plan
or add an extra licence at LKR 6,500/user/month.

[Contact Support]  [Close]
```

---

## 7. Phase 5 — Password Reset & Email Service

> **Goal:** Users can reset their own password without contacting DOK support.
>
> **Email service:** SendGrid (free tier: 100 emails/day — sufficient for launch)
>
> **Estimated build time:** 1 week

### 7.1 New Database Table

```sql
CREATE TABLE password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,     -- hashed token (bcrypt)
  expires_at  TIMESTAMPTZ NOT NULL,      -- 1 hour from creation
  used_at     TIMESTAMPTZ,               -- set when token is consumed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.2 Flow

```
1. User clicks "Forgot Password?" on login page
2. Enters their email address
3. Backend generates secure random token (32 bytes)
4. Hashes token with bcrypt, stores in password_reset_tokens (expires 1 hour)
5. Sends email with link: https://acme.dokcrm.com/reset-password?token=RAW_TOKEN
6. User clicks link → enters new password
7. Backend verifies token hash → updates password → marks token as used
8. User is redirected to login page with success message
```

### 7.3 New API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/forgot-password` | Generate reset token + send email |
| `POST` | `/api/auth/reset-password` | Verify token + update password |
| `GET`  | `/api/auth/verify-reset-token` | Check if token is valid (for UX) |

### 7.4 Email Templates

**Password Reset Email:**
```
Subject: Reset your DOK CRM password

Hi [Name],

You requested a password reset for your DOK CRM account at [Company].

Click the link below to set a new password (valid for 1 hour):

[Reset My Password]  ← button linking to reset URL

If you didn't request this, you can safely ignore this email.
Your password will not change.

— DOK CRM Support Team
```

### 7.5 Files to Create / Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/migrations/012_password_reset_tokens.sql` | Create | Token table |
| `backend/src/lib/emailService.ts` | Create | SendGrid wrapper, email templates |
| `backend/src/controllers/authController.ts` | Modify | Add forgotPassword, resetPassword handlers |
| `backend/src/.env` | Modify | Add SENDGRID_API_KEY, APP_BASE_URL |
| `frontend/src/pages/auth/ForgotPasswordPage.tsx` | Create | Email input form |
| `frontend/src/pages/auth/ResetPasswordPage.tsx` | Create | New password form |
| `frontend/src/pages/auth/LoginPage.tsx` | Modify | Add "Forgot Password?" link |

---

## 8. Phase 6 — Cloud Deployment

> **Goal:** System running on a public server with HTTPS, subdomains,
> daily backups, and uptime monitoring.
>
> **Target:** Hetzner CX22 VPS (~LKR 4,000/month) — best value
>
> **Estimated setup time:** 1 week

### 8.1 Server Specifications

| Component | Specification | Cost |
|-----------|--------------|------|
| **VPS** | Hetzner CX22 — 2 vCPU / 4 GB RAM / 40 GB SSD | ~LKR 4,000/month |
| **OS** | Ubuntu 22.04 LTS | Free |
| **Database** | PostgreSQL 15 (self-hosted on same VPS) | Free |
| **Web server** | Nginx (reverse proxy + SSL) | Free |
| **SSL** | Let's Encrypt wildcard cert (`*.dokcrm.com`) | Free |
| **Domain** | `dokcrm.com` | ~LKR 3,500/year |
| **Email** | SendGrid (100 emails/day free tier) | Free at launch |
| **Backup** | Hetzner Snapshots (weekly) | ~LKR 400/month |
| **Monitoring** | UptimeRobot (free tier) | Free |
| **Total** | | ~LKR 8,000/month |

### 8.2 Docker Compose Stack

```yaml
# docker-compose.yml (production)
services:
  app:
    image: dokcrm-backend:latest
    restart: always
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - JWT_SECRET=${JWT_SECRET}
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:15-alpine
    restart: always
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "dokcrm"]
      interval: 10s

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/dokcrm.conf:/etc/nginx/conf.d/default.conf
      - ./certbot/conf:/etc/letsencrypt
      - frontend_dist:/usr/share/nginx/html

  certbot:
    image: certbot/dns-cloudflare
    volumes:
      - ./certbot/conf:/etc/letsencrypt
    command: certonly --dns-cloudflare --dns-cloudflare-credentials /secrets/cloudflare.ini
             -d "*.dokcrm.com" -d "dokcrm.com"

volumes:
  postgres_data:
  frontend_dist:
```

### 8.3 Nginx Config (Wildcard Subdomain)

```nginx
# nginx/dokcrm.conf

# Redirect HTTP → HTTPS
server {
  listen 80;
  server_name *.dokcrm.com dokcrm.com;
  return 301 https://$host$request_uri;
}

# Super admin panel
server {
  listen 443 ssl http2;
  server_name admin.dokcrm.com;

  ssl_certificate     /etc/letsencrypt/live/dokcrm.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/dokcrm.com/privkey.pem;

  location / {
    proxy_pass http://app:4000;
    proxy_set_header X-Super-Admin true;
  }
}

# All tenant subdomains
server {
  listen 443 ssl http2;
  server_name ~^(?<subdomain>.+)\.dokcrm\.com$;

  ssl_certificate     /etc/letsencrypt/live/dokcrm.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/dokcrm.com/privkey.pem;

  # API calls
  location /api/ {
    proxy_pass http://app:4000;
    proxy_set_header X-Tenant-Subdomain $subdomain;
  }

  # Frontend static files
  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;
  }
}
```

### 8.4 CI/CD Deployment

Simple deploy script for manual deployment (no CI/CD required at launch):

```bash
#!/bin/bash
# scripts/deploy.sh

echo "Pulling latest code..."
git pull origin main

echo "Building frontend..."
cd frontend && npm run build

echo "Copying frontend dist to nginx volume..."
cp -r dist/* /var/www/dokcrm/

echo "Building and restarting backend..."
cd ../backend
docker compose build app
docker compose up -d --no-deps app

echo "Running DB migrations..."
docker compose exec app npx tsx src/lib/migrate.ts

echo "Deploy complete ✓"
```

### 8.5 Backup Automation

```bash
#!/bin/bash
# scripts/backup.sh — runs daily via cron at 2:00 AM

BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
docker compose exec postgres pg_dump -U dokcrm dokcrm > /backups/$BACKUP_FILE
gzip /backups/$BACKUP_FILE

# Keep only last 30 days
find /backups -name "*.sql.gz" -mtime +30 -delete

echo "Backup complete: $BACKUP_FILE.gz"
```

```
# crontab -e
0 2 * * * /opt/dokcrm/scripts/backup.sh >> /var/log/dokcrm-backup.log 2>&1
```

---

## 9. Phase 7 — Post-Launch Features

> Build these after the first paying client is live and stable.

### 9.1 Email Notifications

| Event | Recipient | Trigger |
|-------|-----------|---------|
| Lead assigned to rep | Sales rep | Lead created and assigned |
| Lead stage changed | Lead owner | Stage updated by admin |
| Lead deleted | Admin | Soft delete performed |
| Account created | New user | Admin creates user account |
| Monthly summary | Admin | 1st of each month (cron job) |
| Password reset | User | Forgot password requested |

**Implementation:** SendGrid transactional emails. Each event calls
`emailService.send(template, recipient, data)` from the relevant controller.

---

### 9.2 CSV / Excel Bulk Import

Allows new clients to upload their existing leads from a spreadsheet.

**Flow:**
```
Admin uploads .xlsx or .csv file
    ↓
Backend parses file (xlsx package — already installed)
    ↓
Map columns to lead fields (smart auto-detection + manual override)
    ↓
Validate rows (show errors before importing)
    ↓
Preview page: "152 leads ready, 3 rows have errors"
    ↓
Confirm → bulk insert with ON CONFLICT DO NOTHING
    ↓
Summary: "150 imported, 3 skipped"
```

---

### 9.3 Activity Log per Lead

Full history timeline inside each deal showing every change made.

```sql
CREATE TABLE lead_activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  user_name   VARCHAR(255) NOT NULL,
  action      VARCHAR(50) NOT NULL,   -- 'stage_changed', 'field_updated', 'note_added', 'deleted', 'restored'
  field_name  VARCHAR(100),           -- which field changed (e.g., 'salesStage')
  old_value   TEXT,                   -- previous value
  new_value   TEXT,                   -- new value
  note        TEXT,                   -- for manual notes/comments
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

UI shows a vertical timeline inside the Deal Modal:
```
● [Today 14:32] Theekshana changed stage: Proposal Sent → Negotiated
● [Yesterday 09:15] Pradeepa added a note: "Client wants revised proposal by Friday"
● [Apr 12 11:00] Shanaka created this lead
```

---

### 9.4 Audit Log

Admin-only page showing all system actions with user + timestamp + IP address.

```sql
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id),
  user_email  VARCHAR(255),
  action      VARCHAR(100) NOT NULL,  -- 'user.login', 'lead.delete', 'settings.update'
  resource    VARCHAR(100),           -- 'lead', 'user', 'settings'
  resource_id UUID,
  ip_address  INET,
  user_agent  TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id  ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

---

### 9.5 In-App Notifications

Bell icon in top navigation showing real-time alerts.

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(50) NOT NULL,    -- 'lead_assigned', 'stage_changed', 'system'
  title       VARCHAR(255) NOT NULL,
  message     TEXT,
  read_at     TIMESTAMPTZ,
  link        VARCHAR(500),            -- deep link to the relevant lead/page
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Implementation:** Use 30-second polling (consistent with current useLeads pattern)
or upgrade to WebSocket for real-time delivery.

---

## 10. Phase 8 — Future Growth

> Build when client base grows or clients specifically request these.

### 10.1 Two-Factor Authentication (2FA)
- TOTP via Google Authenticator / Authy
- QR code setup during account creation
- Required for Enterprise tier, optional for Business

### 10.2 REST API Access
- API key authentication (separate from JWT session tokens)
- Rate-limited per tenant
- Endpoints: leads CRUD, activities, reports
- Useful for Enterprise clients integrating with their ERP or accounting software

### 10.3 White-Label / Custom Branding
- Custom domain (`crm.acmecorp.com` instead of `acme.dokcrm.com`)
- Custom email sender domain (`no-reply@acmecorp.com`)
- Completely remove DOK branding from UI
- One-time setup fee: USD 299 / LKR 95,000

### 10.4 File Attachments per Lead
- Upload PDF quotes, contracts, or images to a lead
- Stored in object storage (Hetzner Object Storage / Cloudflare R2)
- Max 5 files per lead, 10 MB each

### 10.5 Mobile Optimization
- Full responsive redesign for sales reps working in the field
- Prioritize: Kanban view, Lead form, Quick add lead

---

## 11. Pricing Model

### Subscription Tiers

| Tier | Users | Monthly (LKR) | Monthly (USD) | Annual (LKR) | Annual (USD) |
|------|-------|--------------|--------------|-------------|-------------|
| **Starter** | 3 | LKR 32,000 | USD 99 | LKR 320,000 | USD 990 |
| **Business** | 10 | LKR 80,000 | USD 249 | LKR 800,000 | USD 2,490 |
| **Enterprise** | Unlimited | LKR 195,000 | USD 599 | LKR 1,950,000 | USD 5,990 |

### Extra Users (Beyond Tier Limit)

| Tier | Extra User / Month |
|------|--------------------|
| Starter (4th–10th user) | LKR 7,500 / USD 25 |
| Business (11th user onward) | LKR 6,500 / USD 20 |
| Enterprise | Included (unlimited) |

### One-Time Fees

| Service | Fee |
|---------|-----|
| Standard onboarding (remote) | LKR 60,000 / USD 199 |
| Enterprise onboarding (with training) | LKR 150,000 / USD 499 |
| Data migration from existing system | LKR 95,000 / USD 299 |
| White-label setup | LKR 95,000 / USD 299 |

---

## 12. Full Build Order & Timeline

```
Week 1  ─── Phase 1: Multi-Tenant DB schema
             ├── Migration: add tenant_id to all tables
             ├── Migration: create tenants table
             ├── tenantModel.ts
             ├── tenantResolver middleware
             └── JWT: add tenantId + plan to payload

Week 2  ─── Phase 1 continued: All controllers + models tenant-scoped
             ├── Add tenantId to all model WHERE clauses
             ├── Update all controllers to pass tenantId
             └── Test: data isolation between two tenants

Week 3  ─── Phase 2: Tenant Configuration system
             ├── Migration: create tenant_configs table
             ├── Migration: remove hardcoded CHECK on sales_stage
             ├── tenantConfigModel + controller + route
             ├── Frontend tenantStore (Zustand)
             └── Load config on login, replace constants.ts usage

Week 4  ─── Phase 2 continued: Workspace Settings UI
             ├── Pipeline Settings tab (stage CRUD + reorder)
             ├── Products Settings tab
             ├── Lead Fields tab (custom field definitions)
             └── DealModal + LeadForm render custom fields

Week 5  ─── Phase 3: Super Admin Panel
             ├── Migration: create dok_admins table
             ├── Super admin auth (separate JWT)
             ├── Tenant CRUD (create, suspend, delete)
             └── Super admin UI at admin.dokcrm.com

Week 6  ─── Phase 4 + 5: License enforcement + Password reset
             ├── User count check on POST /api/users
             ├── Frontend license limit dialog
             ├── Migration: password_reset_tokens table
             ├── Forgot/reset password pages
             └── SendGrid email integration

Week 7  ─── Phase 6: Cloud deployment
             ├── Provision Hetzner CX22 VPS
             ├── Install Docker + Docker Compose
             ├── Nginx wildcard subdomain config
             ├── Let's Encrypt wildcard SSL cert
             ├── Production docker-compose.yml
             └── Backup cron job + UptimeRobot monitoring

Week 8  ─── Testing & internal pilot
             ├── Deploy DOK Group as first internal tenant
             ├── Create admin + sales rep accounts
             ├── Migrate existing lead data
             └── 30-day monitoring period

Week 9  ─── Phase 7: Post-launch features begin
             ├── CSV / Excel bulk import
             ├── Email notifications (lead assigned, stage changed)
             └── Activity log per lead (timeline UI)

Week 10 ─── Go live with first external commercial client
             ├── Commercial readiness checklist complete
             ├── Support email inbox monitored
             └── Onboarding call scheduled
─────────────────────────────────────────────────────────
After launch ─── Audit log, in-app notifications
Later        ─── 2FA, REST API, white-label, mobile optimization
```

---

## 13. Commercial Readiness Checklist

### Technical

- [ ] Multi-tenant: all data queries filter by `tenant_id`
- [ ] Tenant isolation verified (user from Tenant A cannot see Tenant B data)
- [ ] Subdomain routing working (`acme.dokcrm.com`, `xltech.dokcrm.com`)
- [ ] SSL certificate installed — HTTPS enforced, HTTP redirects
- [ ] Per-tenant customization working (custom stages, fields, branding)
- [ ] Super admin panel accessible at `admin.dokcrm.com`
- [ ] License enforcement: user limit blocks creation beyond plan limit
- [ ] Password reset flow working end-to-end (email delivered, token expires)
- [ ] Daily database backup verified (test restore completed)
- [ ] UptimeRobot monitoring configured and alerting
- [ ] Load test passed: 50 concurrent users, < 2 second page load
- [ ] OWASP Top 10 review completed

### Business

- [ ] Pricing page published
- [ ] Support email `support@dokcrm.com` monitored
- [ ] Standard subscription agreement (contract) drafted
- [ ] Invoice / billing process defined
- [ ] User guide documentation published
- [ ] Onboarding checklist prepared
- [ ] First client onboarding call agenda ready

### For Each New Tenant

- [ ] Tenant created in super admin panel (subdomain confirmed)
- [ ] Admin account created, credentials sent securely
- [ ] Welcome email delivered successfully
- [ ] Admin training session scheduled (2 hours)
- [ ] Workspace settings configured (stages, solutions, branding)
- [ ] Existing lead data imported (if applicable)
- [ ] Test transaction done: create → edit → move → delete → restore lead
- [ ] Analytics page confirmed working with real data
- [ ] SLA agreement signed

---

*DOK Technology Team — April 2026*
*Review and update after each completed phase.*
*Next review: after Week 4 (Phases 1–2 complete)*
