# Phase 3 — Super Admin Panel: Design Spec

**Date:** 2026-04-15
**Project:** DOK CRM SaaS
**Phase:** 3 of 8
**Status:** Approved — ready for implementation

---

## 1. Overview

Build a Super Admin panel for DOK internal staff to manage all client tenants
from one place. Completely isolated from the tenant CRM — separate login,
separate JWT, separate route tree, no shared state.

---

## 2. Architecture Decision

**Same repo, separate `/superadmin/*` route tree (Option B)**

- One Vite build, one deployment
- Super admin UI lives under `/superadmin/*` in the same React app
- Completely separate Zustand store (`superAdminStore`)
- Separate auth guard (`SAAuthGuard`) — tenant `ProtectedRoute` does NOT cover these routes
- Super admin JWT uses a different secret key (`SA_JWT_SECRET` env var) and a
  different payload shape — tenant JWTs are rejected even if presented

---

## 3. Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Architecture | Same repo, `/superadmin/*` | One build, one deploy, simpler |
| Tenant creation | Tenant + first admin in one form | Client is login-ready in one action |
| First super admin | `npm run create-superadmin` script | Password never in codebase |
| Suspension model | Option C — check `req.tenant.status` in `requireAuth` | Effectively immediate, zero extra cost |
| Delete flow | Export CSV first, then typed confirmation | Data protection + legal safety |
| Password reset | SA sets temp password, shown once | Works without email service (Phase 5) |

---

## 4. Suspension Model — Option C Detail

The `requireAuth` middleware is extended with a 2-line tenant status check:

```typescript
// requireAuth middleware — after verifying JWT
if (req.tenant && req.tenant.status !== 'active') {
  return res.status(403).json({ error: 'TENANT_SUSPENDED' })
}
```

**Why it is secure:**
- `tenantResolver` runs before `requireAuth` on every protected route — `req.tenant` is always populated
- No authenticated endpoint bypasses `requireAuth`
- Suspension takes effect on the next API request (milliseconds after update)
- In-flight requests at suspension moment complete — acceptable, same gap exists in any approach
- **Future caveat:** if Redis caching is added to `tenantResolver` (Phase 6+), cache TTL must be ≤ 30s

---

## 5. Database

### Migration: `011_create_dok_admins.sql`

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

CREATE INDEX IF NOT EXISTS idx_dok_admins_email ON dok_admins(email);
```

No changes to existing tables. Suspension uses existing `tenants.status` column.

---

## 6. Backend

### 6.1 New Files

```
backend/
  migrations/011_create_dok_admins.sql
  src/
    models/dokAdminModel.ts
    middleware/superAdminAuth.ts
    controllers/superAdminController.ts
    routes/superAdmin.ts
    scripts/createSuperAdmin.ts
```

### 6.2 Setup Script — `scripts/createSuperAdmin.ts`

One-time CLI tool. Run after first deployment:

```bash
npm run create-superadmin
# Prompts: email, display name, password
# bcrypt hashes password → inserts into dok_admins
# Confirms: "Super admin created: dokadmin@gmail.com"
```

### 6.3 `dokAdminModel.ts`

```typescript
findAdminByEmail(email: string): Promise<DokAdmin | null>
updateLastLogin(id: string): Promise<void>
```

### 6.4 `superAdminAuth.ts` Middleware

- Reads `Authorization: Bearer <token>`
- Verifies using `SA_JWT_SECRET` (separate from tenant `JWT_SECRET`)
- Validates `payload.role === 'superadmin'`
- Attaches `req.superAdmin = { adminId, email }`
- Rejects any token that is not role `superadmin`

### 6.5 `superAdminController.ts` — Functions

| Function | Description |
|----------|-------------|
| `login` | bcrypt verify → sign SA JWT → return token |
| `getStats` | Counts: tenants by status, total users, new this month, MRR estimate by plan |
| `listTenants` | All tenants with user_count + lead_count (JOINs) |
| `createTenant` | Transaction: insert tenant + insert first admin user → return temp password (plain, once) |
| `getTenantDetail` | Tenant row + users list + lead count + config snapshot |
| `updateTenant` | Edit: plan, user_limit, status (suspend/activate/cancel) |
| `exportTenantCSV` | Stream CSV: leads sheet + users sheet — triggers before delete |
| `deleteTenant` | Hard delete (CASCADE handles child rows) |
| `searchUsers` | SELECT across users WHERE email ILIKE + tenant name JOIN |
| `resetUserPassword` | bcrypt new temp password → update users.password_hash → return plain once |

### 6.6 API Routes — `routes/superAdmin.ts`

All routes prefixed `/api/super-admin/`. All except login require `superAdminAuth`.

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/auth/login` | `login` |
| `GET` | `/stats` | `getStats` |
| `GET` | `/tenants` | `listTenants` |
| `POST` | `/tenants` | `createTenant` |
| `GET` | `/tenants/:id` | `getTenantDetail` |
| `PUT` | `/tenants/:id` | `updateTenant` |
| `GET` | `/tenants/:id/export` | `exportTenantCSV` |
| `DELETE` | `/tenants/:id` | `deleteTenant` |
| `GET` | `/users/search` | `searchUsers` |
| `PUT` | `/users/:id/password` | `resetUserPassword` |

### 6.7 Existing Middleware Change — `requireAuth.ts`

Add tenant status check after JWT verification:

```typescript
if (req.tenant && req.tenant.status !== 'active') {
  return res.status(403).json({
    error: 'TENANT_SUSPENDED',
    message: 'Your account has been suspended. Please contact support.'
  })
}
```

---

## 7. Frontend

### 7.1 New Files

```
frontend/src/
  store/superAdminStore.ts
  pages/superadmin/
    SALogin.tsx
    SALayout.tsx
    SADashboard.tsx
    SATenantsPage.tsx
    SACreateTenantModal.tsx
    SATenantDetailPage.tsx
    SAUsersPage.tsx
```

### 7.2 `superAdminStore.ts`

```typescript
interface SuperAdminState {
  token:      string | null
  admin:      { adminId: string; email: string } | null
  isLoggedIn: boolean
  login(token, admin): void
  logout(): void
}
```

Token persisted to `localStorage` under key `sa_token` — separate from tenant `auth_token`.

### 7.3 `SAAuthGuard` Component

Wraps all `/superadmin/*` routes except login. Redirects to `/superadmin/login` if not logged in. Completely independent from tenant `ProtectedRoute`.

### 7.4 Route Tree in `App.tsx`

```
/superadmin/login         → SALogin (no layout, no guard)
/superadmin/*             → SAAuthGuard
  /superadmin/            → SADashboard (inside SALayout)
  /superadmin/tenants     → SATenantsPage
  /superadmin/tenants/:id → SATenantDetailPage
  /superadmin/users       → SAUsersPage
```

### 7.5 Page Designs

#### `SALogin.tsx`
- Standalone page — no AppLayout, no sidebar
- Email + password form
- POST `/api/super-admin/auth/login`
- On success: store token → redirect to `/superadmin/`

#### `SALayout.tsx`
- Minimal sidebar: Dashboard, Tenants, Users
- Header: "DOK Super Admin" label + logout button
- Visually distinct from tenant CRM (darker theme or different accent)

#### `SADashboard.tsx`
Stats cards row:
- Active Tenants / Suspended / Trial
- Total Users across all tenants
- New tenants this month
- Estimated MRR (plan counts × price)

#### `SATenantsPage.tsx`
- Table: Name, Subdomain, Plan, Users, Status badge, Created date, Actions
- Actions per row: View, Edit, Suspend/Activate, Export+Delete
- [+ New Tenant] button opens `SACreateTenantModal`
- Status badges: green (active), yellow (trial), red (suspended)

#### `SACreateTenantModal.tsx`
Two-step modal:

**Step 1 — Fill form:**
```
Company Name  / Subdomain / Plan / User Limit / Trial End (optional)
Admin Name    / Admin Email / (temp password auto-generated)
```

**Step 2 — Success screen (after save):**
```
Tenant created successfully!
Share these credentials with your client:

  Login URL:     https://[subdomain].dokcrm.com  (or /?tenant=[subdomain])
  Email:         john@acme.com
  Temp Password: Xk9#mP2q  [Copy]

The password will not be shown again.
[Close]
```

#### `SATenantDetailPage.tsx`
- Tenant info card (plan, status, created, trial end)
- Users table: name, email, role, last login
- Stats: lead count, activity count
- Config snapshot: stage names listed
- Action buttons: Edit Plan, Suspend/Activate, Export CSV → Delete

**Delete flow:**
```
Click Delete →
  Modal Step 1: "Download tenant data before deleting"
    [Download CSV]  [Delete Without Export]  [Cancel]
  Modal Step 2: Type subdomain to confirm
    Input: [        ]   placeholder: "type acme to confirm"
    [Confirm Delete — This cannot be undone]
```

#### `SAUsersPage.tsx`
- Search bar: search by email across all tenants
- Result shows: name, email, role, tenant name, last login
- [Reset Password] button → opens small modal:
  ```
  New Temporary Password
  [_______________]  ← SA types it
  [Set Password]
  ```
  After save: shows the password once with copy button

---

## 8. Security Summary

| Concern | How it is handled |
|---------|------------------|
| SA JWT separate from tenant JWT | Different secret (`SA_JWT_SECRET`), different payload shape |
| Tenant JWTs rejected on SA routes | `superAdminAuth` validates `role === 'superadmin'` |
| SA tokens rejected on tenant routes | `requireAuth` only accepts `role` of `admin` or `sales` |
| Tenant suspension effective immediately | `requireAuth` checks `req.tenant.status` on every request |
| First SA password not in codebase | `create-superadmin` script, not migration seed |
| Destructive delete requires confirmation | CSV export step + typed subdomain confirmation |
| Temp passwords shown once | Never stored in plain text; only returned once from API |

---

## 9. Files to Create / Modify

### Backend — New Files

| File | Purpose |
|------|---------|
| `backend/migrations/011_create_dok_admins.sql` | dok_admins table |
| `backend/src/models/dokAdminModel.ts` | findByEmail, updateLastLogin |
| `backend/src/middleware/superAdminAuth.ts` | SA JWT verification |
| `backend/src/controllers/superAdminController.ts` | All SA business logic |
| `backend/src/routes/superAdmin.ts` | Route definitions |
| `backend/src/scripts/createSuperAdmin.ts` | One-time setup CLI |

### Backend — Modified Files

| File | Change |
|------|--------|
| `backend/src/middleware/requireAuth.ts` | Add tenant status check (Option C) |
| `backend/src/routes/index.ts` | Register `/super-admin` routes |
| `backend/.env.example` | Add `SA_JWT_SECRET` |

### Frontend — New Files

| File | Purpose |
|------|---------|
| `frontend/src/store/superAdminStore.ts` | SA auth state |
| `frontend/src/pages/superadmin/SALogin.tsx` | SA login page |
| `frontend/src/pages/superadmin/SALayout.tsx` | SA sidebar + header |
| `frontend/src/pages/superadmin/SADashboard.tsx` | Stats overview |
| `frontend/src/pages/superadmin/SATenantsPage.tsx` | Tenants table |
| `frontend/src/pages/superadmin/SACreateTenantModal.tsx` | Create tenant + first admin |
| `frontend/src/pages/superadmin/SATenantDetailPage.tsx` | Tenant detail + actions |
| `frontend/src/pages/superadmin/SAUsersPage.tsx` | Cross-tenant user search |

### Frontend — Modified Files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add `/superadmin/*` route tree + SAAuthGuard |

---

## 10. What is NOT in Phase 3

- Email notifications on suspension (Phase 5)
- Token blacklisting / immediate invalidation of in-flight sessions (future)
- Super admin 2FA (future)
- Audit log of super admin actions (future)
- Redis caching of tenant status (Phase 6)
