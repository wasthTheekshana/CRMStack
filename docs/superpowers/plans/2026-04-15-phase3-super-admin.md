# Phase 3 — Super Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a completely isolated Super Admin panel at `/superadmin/*` for DOK internal staff to manage all client tenants — create, suspend, delete tenants, reset user passwords, and view system-wide stats.

**Architecture:** Same repo, separate route tree. Super admin routes bypass tenant middleware entirely and use a separate JWT secret (`SA_JWT_SECRET`). Tenant suspension is enforced by checking `req.tenant.status` inside `requireAuth` on every request (Option C — effectively immediate, zero extra cost).

**Tech Stack:** Express + TypeScript + PostgreSQL + bcryptjs + jsonwebtoken (backend); React 18 + TypeScript + Zustand + React Router v6 + shadcn/ui + Tailwind (frontend)

---

## File Map

### Backend — New Files
| File | Responsibility |
|------|---------------|
| `backend/migrations/011_create_dok_admins.sql` | dok_admins table |
| `backend/src/models/dokAdminModel.ts` | findByEmail, updateLastLogin |
| `backend/src/middleware/superAdminAuth.ts` | Verify SA JWT (role: superadmin) |
| `backend/src/controllers/superAdminController.ts` | All SA business logic (10 handlers) |
| `backend/src/routes/superAdmin.ts` | Route definitions for /api/super-admin/* |
| `backend/src/scripts/createSuperAdmin.ts` | One-time interactive CLI to seed first SA |

### Backend — Modified Files
| File | Change |
|------|--------|
| `backend/src/middleware/auth.ts` | Add Option C tenant status check in requireAuth |
| `backend/src/routes/index.ts` | Register superAdmin routes |
| `backend/.env.example` | Add SA_JWT_SECRET |

### Frontend — New Files
| File | Responsibility |
|------|---------------|
| `frontend/src/services/saService.ts` | All SA API calls with SA token |
| `frontend/src/store/superAdminStore.ts` | SA auth state (Zustand, persisted) |
| `frontend/src/components/auth/SAAuthGuard.tsx` | Route guard for /superadmin/* |
| `frontend/src/pages/superadmin/SALogin.tsx` | Standalone SA login page |
| `frontend/src/pages/superadmin/SALayout.tsx` | SA sidebar + header |
| `frontend/src/pages/superadmin/SADashboard.tsx` | Stats overview cards |
| `frontend/src/pages/superadmin/SATenantsPage.tsx` | Tenants table + actions |
| `frontend/src/pages/superadmin/SACreateTenantModal.tsx` | Create tenant + first admin form |
| `frontend/src/pages/superadmin/SATenantDetailPage.tsx` | Tenant detail + suspend/delete |
| `frontend/src/pages/superadmin/SAUsersPage.tsx` | Cross-tenant user search + password reset |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add /superadmin/* route tree with SAAuthGuard |

---

## Task 1: Database Migration — dok_admins Table

**Files:**
- Create: `backend/migrations/011_create_dok_admins.sql`

- [ ] **Step 1: Create migration file**

```sql
-- backend/migrations/011_create_dok_admins.sql
CREATE TABLE IF NOT EXISTS dok_admins (
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

- [ ] **Step 2: Run migration against Docker PostgreSQL**

```powershell
Get-Content backend\migrations\011_create_dok_admins.sql | docker exec -i dokcrm_postgres psql -U dokcrm -d dokcrm
```

Expected output:
```
CREATE TABLE
CREATE INDEX
```

- [ ] **Step 3: Verify table exists**

```powershell
docker exec -it dokcrm_postgres psql -U dokcrm -d dokcrm -c "\d dok_admins"
```

Expected: Table showing 7 columns (id, email, display_name, password_hash, is_active, created_at, last_login_at)

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/011_create_dok_admins.sql
git commit -m "feat: add dok_admins table migration"
```

---

## Task 2: dokAdminModel

**Files:**
- Create: `backend/src/models/dokAdminModel.ts`

- [ ] **Step 1: Create the model**

```typescript
// backend/src/models/dokAdminModel.ts
import { query } from '../config/db';

export interface DokAdmin {
  id:          string;
  email:       string;
  displayName: string;
  passwordHash: string;
  isActive:    boolean;
  createdAt:   Date;
  lastLoginAt: Date | null;
}

const mapAdmin = (row: Record<string, unknown>): DokAdmin => ({
  id:           row.id as string,
  email:        row.email as string,
  displayName:  row.display_name as string,
  passwordHash: row.password_hash as string,
  isActive:     row.is_active as boolean,
  createdAt:    row.created_at as Date,
  lastLoginAt:  row.last_login_at as Date | null,
});

export async function findAdminByEmail(email: string): Promise<DokAdmin | null> {
  const result = await query(
    'SELECT * FROM dok_admins WHERE email = $1 AND is_active = TRUE',
    [email.toLowerCase().trim()]
  );
  return result.rows.length ? mapAdmin(result.rows[0]) : null;
}

export async function updateAdminLastLogin(id: string): Promise<void> {
  await query(
    'UPDATE dok_admins SET last_login_at = NOW() WHERE id = $1',
    [id]
  );
}

export async function createAdmin(data: {
  email:       string;
  displayName: string;
  passwordHash: string;
}): Promise<DokAdmin> {
  const result = await query(
    `INSERT INTO dok_admins (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.email.toLowerCase().trim(), data.displayName, data.passwordHash]
  );
  return mapAdmin(result.rows[0]);
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/dokAdminModel.ts
git commit -m "feat: add dokAdminModel"
```

---

## Task 3: superAdminAuth Middleware

**Files:**
- Create: `backend/src/middleware/superAdminAuth.ts`

- [ ] **Step 1: Create middleware**

```typescript
// backend/src/middleware/superAdminAuth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface SAPayload {
  adminId: string;
  role:    'superadmin';
  email:   string;
}

declare global {
  namespace Express {
    interface Request {
      superAdmin?: SAPayload;
    }
  }
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.SA_JWT_SECRET!) as SAPayload;
    if (payload.role !== 'superadmin') {
      res.status(403).json({ error: 'Super admin access required' });
      return;
    }
    req.superAdmin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/middleware/superAdminAuth.ts
git commit -m "feat: add superAdminAuth middleware with separate SA_JWT_SECRET"
```

---

## Task 4: createSuperAdmin Setup Script

**Files:**
- Create: `backend/src/scripts/createSuperAdmin.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Create the script**

```typescript
// backend/src/scripts/createSuperAdmin.ts
import * as readline from 'readline';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { query } from '../config/db';

dotenv.config();

const rl = readline.createInterface({
  input:  process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('\n  DOK CRM — Create Super Admin\n');

  const email       = await ask('  Email:        ');
  const displayName = await ask('  Display Name: ');
  const password    = await ask('  Password:     ');

  if (!email || !displayName || !password) {
    console.error('\n  All fields are required.\n');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await query(
    `INSERT INTO dok_admins (email, display_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET
       display_name  = EXCLUDED.display_name,
       password_hash = EXCLUDED.password_hash,
       is_active     = TRUE`,
    [email.toLowerCase().trim(), displayName, passwordHash]
  );

  console.log(`\n  Super admin created: ${email}\n`);
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n  Error:', err.message, '\n');
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script to `backend/package.json`**

Find the `"scripts"` section and add:
```json
"create-superadmin": "tsx src/scripts/createSuperAdmin.ts"
```

So the scripts section becomes:
```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "migrate": "tsx src/lib/migrate.ts",
  "import-leads": "tsx src/import-excel-leads.ts",
  "create-superadmin": "tsx src/scripts/createSuperAdmin.ts"
}
```

- [ ] **Step 3: Add SA_JWT_SECRET to `.env.example`**

Open `backend/.env.example` and add:
```
SA_JWT_SECRET=your-super-admin-jwt-secret-here
```

Also add `SA_JWT_SECRET` to your local `backend/.env` file:
```
SA_JWT_SECRET=dok_sa_secret_change_in_production
```

- [ ] **Step 4: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/createSuperAdmin.ts backend/package.json backend/.env.example
git commit -m "feat: add create-superadmin CLI script"
```

---

## Task 5: Super Admin Controller — Login

**Files:**
- Create: `backend/src/controllers/superAdminController.ts` (first section only)

- [ ] **Step 1: Create controller with login handler**

```typescript
// backend/src/controllers/superAdminController.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findAdminByEmail, updateAdminLastLogin } from '../models/dokAdminModel';
import { query } from '../config/db';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  try {
    const admin = await findAdminByEmail(email);
    if (!admin) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    await updateAdminLastLogin(admin.id);

    const token = jwt.sign(
      { adminId: admin.id, role: 'superadmin', email: admin.email },
      process.env.SA_JWT_SECRET!,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      admin: {
        adminId:     admin.id,
        email:       admin.email,
        displayName: admin.displayName,
      },
    });
  } catch (err) {
    console.error('SA login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/superAdminController.ts
git commit -m "feat: add super admin login handler"
```

---

## Task 6: Super Admin Controller — Stats + Tenant List

**Files:**
- Modify: `backend/src/controllers/superAdminController.ts` (append)

- [ ] **Step 1: Append stats and listTenants handlers**

Add these functions to the END of `backend/src/controllers/superAdminController.ts`:

```typescript
// ─── Stats ────────────────────────────────────────────────────────────────────

export async function getStats(_req: Request, res: Response) {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')    AS active_tenants,
        COUNT(*) FILTER (WHERE status = 'suspended') AS suspended_tenants,
        COUNT(*) FILTER (WHERE trial_ends_at > NOW() AND status = 'active') AS trial_tenants,
        COUNT(*) AS total_tenants
      FROM tenants
    `);

    const userResult = await query(`SELECT COUNT(*) AS total_users FROM users`);

    const newThisMonthResult = await query(`
      SELECT COUNT(*) AS new_this_month
      FROM tenants
      WHERE created_at >= date_trunc('month', NOW())
    `);

    const planResult = await query(`
      SELECT plan, COUNT(*) AS count
      FROM tenants
      WHERE status = 'active'
      GROUP BY plan
    `);

    const planCounts: Record<string, number> = {};
    planResult.rows.forEach((r: Record<string, unknown>) => {
      planCounts[r.plan as string] = Number(r.count);
    });

    // Estimated MRR in USD
    const PLAN_PRICE: Record<string, number> = {
      starter:    99,
      business:   249,
      enterprise: 599,
    };
    const estimatedMRR = Object.entries(planCounts).reduce(
      (sum, [plan, count]) => sum + (PLAN_PRICE[plan] || 0) * count,
      0
    );

    res.json({
      activeTenants:    Number(result.rows[0].active_tenants),
      suspendedTenants: Number(result.rows[0].suspended_tenants),
      trialTenants:     Number(result.rows[0].trial_tenants),
      totalTenants:     Number(result.rows[0].total_tenants),
      totalUsers:       Number(userResult.rows[0].total_users),
      newThisMonth:     Number(newThisMonthResult.rows[0].new_this_month),
      planCounts,
      estimatedMRR,
    });
  } catch (err) {
    console.error('SA getStats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Tenants List ─────────────────────────────────────────────────────────────

export async function listTenants(_req: Request, res: Response) {
  try {
    const result = await query(`
      SELECT
        t.id,
        t.name,
        t.subdomain,
        t.plan,
        t.status,
        t.user_limit,
        t.owner_email,
        t.created_at,
        t.trial_ends_at,
        COUNT(DISTINCT u.id) AS user_count,
        COUNT(DISTINCT l.id) AS lead_count
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      LEFT JOIN leads l ON l.tenant_id = t.id AND l.is_deleted = FALSE
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);

    res.json(result.rows.map((r: Record<string, unknown>) => ({
      id:          r.id,
      name:        r.name,
      subdomain:   r.subdomain,
      plan:        r.plan,
      status:      r.status,
      userLimit:   Number(r.user_limit),
      ownerEmail:  r.owner_email,
      createdAt:   r.created_at,
      trialEndsAt: r.trial_ends_at,
      userCount:   Number(r.user_count),
      leadCount:   Number(r.lead_count),
    })));
  } catch (err) {
    console.error('SA listTenants error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/superAdminController.ts
git commit -m "feat: add SA stats and tenant list handlers"
```

---

## Task 7: Super Admin Controller — Create Tenant

**Files:**
- Modify: `backend/src/controllers/superAdminController.ts` (append)

- [ ] **Step 1: Add helper and createTenant handler**

Add this to the END of `backend/src/controllers/superAdminController.ts`:

```typescript
// ─── Create Tenant ────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function createTenant(req: Request, res: Response) {
  const {
    name,
    subdomain,
    plan        = 'starter',
    userLimit   = 3,
    trialEndsAt = null,
    adminName,
    adminEmail,
  } = req.body;

  if (!name || !subdomain || !adminName || !adminEmail) {
    res.status(400).json({ error: 'name, subdomain, adminName, adminEmail are required' });
    return;
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const client = await (await import('../config/db')).pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, subdomain, plan, status, user_limit, owner_email)
       VALUES ($1, $2, $3, 'active', $4, $5)
       RETURNING *`,
      [name, subdomain.toLowerCase().trim(), plan, userLimit, adminEmail]
    );
    const tenant = tenantResult.rows[0];

    // 2. Set trial end if provided
    if (trialEndsAt) {
      await client.query(
        'UPDATE tenants SET trial_ends_at = $1 WHERE id = $2',
        [trialEndsAt, tenant.id]
      );
    }

    // 3. Create first admin user
    const username = adminEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    await client.query(
      `INSERT INTO users (tenant_id, email, username, display_name, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, 'admin', TRUE)`,
      [tenant.id, adminEmail.toLowerCase().trim(), username, adminName, passwordHash]
    );

    // 3. Seed default tenant config
    await client.query(
      `INSERT INTO tenant_configs (tenant_id, sales_stages, solutions, custom_fields, visible_fields, branding)
       VALUES ($1,
         '[{"id":"s1","name":"On Hold","color":"#F97316","probability":10,"order":0,"isWon":false},{"id":"s2","name":"Meeting Pending","color":"#3B82F6","probability":25,"order":1,"isWon":false},{"id":"s3","name":"Proposal Sent","color":"#8B5CF6","probability":50,"order":2,"isWon":false},{"id":"s4","name":"Negotiated","color":"#A855F7","probability":75,"order":3,"isWon":false},{"id":"s5","name":"Verbal Yes","color":"#EC4899","probability":90,"order":4,"isWon":false},{"id":"s6","name":"Closed & Won","color":"#22C55E","probability":100,"order":5,"isWon":true}]'::jsonb,
         '[{"id":"p1","name":"Document Management"},{"id":"p2","name":"Digital Archiving"},{"id":"p3","name":"Workflow Automation"}]'::jsonb,
         '[]'::jsonb,
         '{}'::jsonb,
         '{}'::jsonb
       )`,
      [tenant.id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      tenant: {
        id:        tenant.id,
        name:      tenant.name,
        subdomain: tenant.subdomain,
        plan:      tenant.plan,
      },
      adminEmail,
      tempPassword,
    });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    console.error('SA createTenant error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    if (message.includes('unique') || message.includes('duplicate')) {
      res.status(409).json({ error: 'Subdomain or email already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    client.release();
  }
}
```

- [ ] **Step 2: Export pool from db config — check if pool is exported**

```bash
grep -n "export.*pool\|export.*query" "d:/Project/Sale Funnel/backend/src/config/db.ts"
```

If `pool` is not exported, open `backend/src/config/db.ts` and add `export` before the pool declaration, e.g.:
```typescript
export const pool = new Pool({ ... })
```

- [ ] **Step 3: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/superAdminController.ts backend/src/config/db.ts
git commit -m "feat: add SA createTenant handler with transaction"
```

---

## Task 8: Super Admin Controller — Tenant Detail + Update

**Files:**
- Modify: `backend/src/controllers/superAdminController.ts` (append)

- [ ] **Step 1: Append getTenantDetail and updateTenant**

Add to the END of `backend/src/controllers/superAdminController.ts`:

```typescript
// ─── Tenant Detail ────────────────────────────────────────────────────────────

export async function getTenantDetail(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const tenantResult = await query(
      'SELECT * FROM tenants WHERE id = $1',
      [id]
    );
    if (!tenantResult.rows.length) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const tenant = tenantResult.rows[0];

    const usersResult = await query(
      `SELECT id, email, username, display_name, role, is_active, last_login_at, created_at
       FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const statsResult = await query(
      `SELECT
         COUNT(DISTINCT l.id) FILTER (WHERE l.is_deleted = FALSE) AS lead_count,
         COUNT(DISTINCT a.id) AS activity_count
       FROM tenants t
       LEFT JOIN leads l      ON l.tenant_id = t.id
       LEFT JOIN activities a ON a.tenant_id = t.id
       WHERE t.id = $1`,
      [id]
    );

    const configResult = await query(
      'SELECT sales_stages, solutions FROM tenant_configs WHERE tenant_id = $1',
      [id]
    );

    const config = configResult.rows[0] || null;

    res.json({
      tenant: {
        id:          tenant.id,
        name:        tenant.name,
        subdomain:   tenant.subdomain,
        plan:        tenant.plan,
        status:      tenant.status,
        userLimit:   tenant.user_limit,
        ownerEmail:  tenant.owner_email,
        createdAt:   tenant.created_at,
        trialEndsAt: tenant.trial_ends_at,
      },
      users: usersResult.rows.map((u: Record<string, unknown>) => ({
        id:          u.id,
        email:       u.email,
        username:    u.username,
        displayName: u.display_name,
        role:        u.role,
        isActive:    u.is_active,
        lastLoginAt: u.last_login_at,
        createdAt:   u.created_at,
      })),
      stats: {
        leadCount:     Number(statsResult.rows[0]?.lead_count     ?? 0),
        activityCount: Number(statsResult.rows[0]?.activity_count ?? 0),
      },
      config: config ? {
        stageNames:    (config.sales_stages as Array<{name: string}>).map(s => s.name),
        solutionNames: (config.solutions    as Array<{name: string}>).map(s => s.name),
      } : null,
    });
  } catch (err) {
    console.error('SA getTenantDetail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Update Tenant ────────────────────────────────────────────────────────────

export async function updateTenant(req: Request, res: Response) {
  const { id } = req.params;
  const { plan, userLimit, status } = req.body;

  const updates: string[] = [];
  const values:  unknown[] = [];
  let idx = 1;

  if (plan !== undefined) {
    updates.push(`plan = $${idx++}`);
    values.push(plan);
  }
  if (userLimit !== undefined) {
    updates.push(`user_limit = $${idx++}`);
    values.push(userLimit);
  }
  if (status !== undefined) {
    updates.push(`status = $${idx++}`);
    values.push(status);
    if (status === 'suspended') {
      updates.push(`suspended_at = NOW()`);
    } else {
      updates.push(`suspended_at = NULL`);
    }
  }

  if (!updates.length) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  try {
    const result = await query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const t = result.rows[0];
    res.json({
      id:        t.id,
      name:      t.name,
      subdomain: t.subdomain,
      plan:      t.plan,
      status:    t.status,
      userLimit: t.user_limit,
    });
  } catch (err) {
    console.error('SA updateTenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/superAdminController.ts
git commit -m "feat: add SA getTenantDetail and updateTenant handlers"
```

---

## Task 9: Super Admin Controller — Export CSV + Delete Tenant

**Files:**
- Modify: `backend/src/controllers/superAdminController.ts` (append)

- [ ] **Step 1: Append exportTenantCSV and deleteTenant**

Add to the END of `backend/src/controllers/superAdminController.ts`:

```typescript
// ─── Export CSV ───────────────────────────────────────────────────────────────

export async function exportTenantCSV(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const tenantResult = await query('SELECT name, subdomain FROM tenants WHERE id = $1', [id]);
    if (!tenantResult.rows.length) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const subdomain = tenantResult.rows[0].subdomain as string;

    const usersResult = await query(
      `SELECT email, display_name, role, is_active, created_at, last_login_at
       FROM users WHERE tenant_id = $1`,
      [id]
    );

    const leadsResult = await query(
      `SELECT company_name, contact_name, contact_number, solution,
              sales_stage, estimated_revenue, probability, remarks, created_at
       FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE ORDER BY created_at DESC`,
      [id]
    );

    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines: string[] = [];

    // Users section
    lines.push('USERS');
    lines.push('Email,Name,Role,Active,Created,Last Login');
    usersResult.rows.forEach((u: Record<string, unknown>) => {
      lines.push([u.email, u.display_name, u.role, u.is_active,
                  u.created_at, u.last_login_at].map(escape).join(','));
    });

    lines.push('');

    // Leads section
    lines.push('LEADS');
    lines.push('Company,Contact,Phone,Solution,Stage,Revenue,Probability,Remarks,Created');
    leadsResult.rows.forEach((l: Record<string, unknown>) => {
      lines.push([l.company_name, l.contact_name, l.contact_number, l.solution,
                  l.sales_stage, l.estimated_revenue, l.probability,
                  l.remarks, l.created_at].map(escape).join(','));
    });

    const csv = lines.join('\n');
    const filename = `${subdomain}-export-${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('SA exportTenantCSV error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Delete Tenant ────────────────────────────────────────────────────────────

export async function deleteTenant(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await query(
      'DELETE FROM tenants WHERE id = $1 RETURNING id, name, subdomain',
      [id]
    );
    if (!result.rows.length) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    res.json({ deleted: true, tenant: result.rows[0] });
  } catch (err) {
    console.error('SA deleteTenant error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/superAdminController.ts
git commit -m "feat: add SA exportTenantCSV and deleteTenant handlers"
```

---

## Task 10: Super Admin Controller — User Search + Password Reset

**Files:**
- Modify: `backend/src/controllers/superAdminController.ts` (append)

- [ ] **Step 1: Append searchUsers and resetUserPassword**

Add to the END of `backend/src/controllers/superAdminController.ts`:

```typescript
// ─── Users ────────────────────────────────────────────────────────────────────

export async function searchUsers(req: Request, res: Response) {
  const { email } = req.query as { email?: string };
  if (!email || email.trim().length < 2) {
    res.status(400).json({ error: 'email query param required (min 2 chars)' });
    return;
  }

  try {
    const result = await query(
      `SELECT u.id, u.email, u.display_name, u.role, u.is_active,
              u.last_login_at, u.created_at,
              t.name AS tenant_name, t.subdomain, t.id AS tenant_id
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email ILIKE $1
       ORDER BY u.created_at DESC
       LIMIT 50`,
      [`%${email.trim()}%`]
    );

    res.json(result.rows.map((r: Record<string, unknown>) => ({
      id:          r.id,
      email:       r.email,
      displayName: r.display_name,
      role:        r.role,
      isActive:    r.is_active,
      lastLoginAt: r.last_login_at,
      createdAt:   r.created_at,
      tenantId:    r.tenant_id,
      tenantName:  r.tenant_name,
      subdomain:   r.subdomain,
    })));
  } catch (err) {
    console.error('SA searchUsers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function resetUserPassword(req: Request, res: Response) {
  const { id } = req.params;
  const { tempPassword } = req.body;

  if (!tempPassword || tempPassword.length < 6) {
    res.status(400).json({ error: 'tempPassword required (min 6 chars)' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const result = await query(
      `UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email, display_name`,
      [passwordHash, id]
    );
    if (!result.rows.length) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({
      updated:      true,
      userId:       result.rows[0].id,
      email:        result.rows[0].email,
      displayName:  result.rows[0].display_name,
      tempPassword,
    });
  } catch (err) {
    console.error('SA resetUserPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/superAdminController.ts
git commit -m "feat: add SA user search and password reset handlers"
```

---

## Task 11: Routes + requireAuth Update + Register SA Routes

**Files:**
- Create: `backend/src/routes/superAdmin.ts`
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/src/routes/index.ts`

- [ ] **Step 1: Create SA routes file**

```typescript
// backend/src/routes/superAdmin.ts
import { Router } from 'express';
import { requireSuperAdmin } from '../middleware/superAdminAuth';
import {
  login,
  getStats,
  listTenants,
  createTenant,
  getTenantDetail,
  updateTenant,
  exportTenantCSV,
  deleteTenant,
  searchUsers,
  resetUserPassword,
} from '../controllers/superAdminController';

const router = Router();

// Public — no auth required
router.post('/auth/login', login);

// All routes below require SA JWT
router.use(requireSuperAdmin);

router.get('/stats',                   getStats);
router.get('/tenants',                 listTenants);
router.post('/tenants',                createTenant);
router.get('/tenants/:id',             getTenantDetail);
router.put('/tenants/:id',             updateTenant);
router.get('/tenants/:id/export',      exportTenantCSV);
router.delete('/tenants/:id',          deleteTenant);
router.get('/users/search',            searchUsers);
router.put('/users/:id/password',      resetUserPassword);

export default router;
```

- [ ] **Step 2: Add Option C tenant status check to `requireAuth`**

Open `backend/src/middleware/auth.ts` and modify `requireAuth` to add the status check right after setting `req.user`:

```typescript
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    req.user = payload;

    // Option C: block all requests if tenant is suspended/cancelled
    if (req.tenant && req.tenant.status !== 'active') {
      res.status(403).json({
        error:   'TENANT_SUSPENDED',
        message: 'Your account has been suspended. Please contact support.',
      });
      return;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

- [ ] **Step 3: Register SA routes in `routes/index.ts`**

Open `backend/src/routes/index.ts` and add:

```typescript
import superAdminRoutes from './superAdmin';
```

And at the bottom before `export default router`:
```typescript
router.use('/super-admin', superAdminRoutes);
```

Full file becomes:
```typescript
import { Router } from 'express';
import authRoutes         from './auth';
import userRoutes         from './users';
import leadRoutes         from './leads';
import taskRoutes         from './tasks';
import activityRoutes     from './activities';
import salesTargetRoutes  from './salesTargets';
import settingsRoutes     from './settings';
import kpiRoutes          from './kpis';
import tenantRoutes       from './tenants';
import tenantConfigRoutes from './tenantConfig';
import superAdminRoutes   from './superAdmin';

const router = Router();

router.use('/auth',          authRoutes);
router.use('/users',         userRoutes);
router.use('/leads',         leadRoutes);
router.use('/tasks',         taskRoutes);
router.use('/activities',    activityRoutes);
router.use('/sales-targets', salesTargetRoutes);
router.use('/settings',      settingsRoutes);
router.use('/kpis',          kpiRoutes);
router.use('/tenants',       tenantRoutes);
router.use('/tenant/config', tenantConfigRoutes);
router.use('/super-admin',   superAdminRoutes);

export default router;
```

- [ ] **Step 4: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 5: Start backend and test login endpoint**

```bash
cd backend && npm run dev
```

In a new terminal:
```bash
# First create a super admin
cd backend && npm run create-superadmin
# Enter: email=dokadmin@gmail.com, name=DOK Admin, password=Test@123

# Test login
curl -s -X POST http://localhost:4000/api/super-admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dokadmin@gmail.com","password":"Test@123"}' | jq .
```

Expected response:
```json
{
  "token": "eyJ...",
  "admin": { "adminId": "...", "email": "dokadmin@gmail.com", "displayName": "DOK Admin" }
}
```

- [ ] **Step 6: Test stats endpoint with SA token**

```bash
SA_TOKEN="<paste token from above>"
curl -s http://localhost:4000/api/super-admin/stats \
  -H "Authorization: Bearer $SA_TOKEN" | jq .
```

Expected: JSON with `activeTenants`, `totalUsers`, `estimatedMRR`, etc.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/superAdmin.ts backend/src/middleware/auth.ts backend/src/routes/index.ts
git commit -m "feat: wire SA routes, add Option C tenant suspension check to requireAuth"
```

---

## Task 12: Frontend SA Service + Zustand Store

**Files:**
- Create: `frontend/src/services/saService.ts`
- Create: `frontend/src/store/superAdminStore.ts`

- [ ] **Step 1: Create SA service with its own token fetch**

```typescript
// frontend/src/services/saService.ts
import { API_BASE_URL } from '@/config/api'

const SA_TOKEN_KEY = 'dok_sa_token';

export const saTokenStorage = {
  get:   ()              => localStorage.getItem(SA_TOKEN_KEY),
  set:   (token: string) => localStorage.setItem(SA_TOKEN_KEY, token),
  clear: ()              => localStorage.removeItem(SA_TOKEN_KEY),
};

async function saFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = saTokenStorage.get();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `SA API error ${res.status}`);
  }

  // For CSV download — return blob URL
  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('text/csv')) {
    const blob = await res.blob();
    return URL.createObjectURL(blob) as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SATenant {
  id:          string
  name:        string
  subdomain:   string
  plan:        'starter' | 'business' | 'enterprise'
  status:      'active' | 'suspended' | 'cancelled'
  userLimit:   number
  ownerEmail:  string
  createdAt:   string
  trialEndsAt: string | null
  userCount:   number
  leadCount:   number
}

export interface SATenantDetail {
  tenant: Omit<SATenant, 'userCount' | 'leadCount'>
  users: Array<{
    id: string; email: string; displayName: string; role: string
    isActive: boolean; lastLoginAt: string | null; createdAt: string
  }>
  stats:  { leadCount: number; activityCount: number }
  config: { stageNames: string[]; solutionNames: string[] } | null
}

export interface SAStats {
  activeTenants:    number
  suspendedTenants: number
  trialTenants:     number
  totalTenants:     number
  totalUsers:       number
  newThisMonth:     number
  planCounts:       Record<string, number>
  estimatedMRR:     number
}

export interface SAUser {
  id: string; email: string; displayName: string; role: string
  isActive: boolean; lastLoginAt: string | null
  tenantId: string; tenantName: string; subdomain: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function saLogin(email: string, password: string) {
  return saFetch<{ token: string; admin: { adminId: string; email: string; displayName: string } }>(
    '/api/super-admin/auth/login',
    { method: 'POST', body: JSON.stringify({ email, password }) }
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function fetchSAStats() {
  return saFetch<SAStats>('/api/super-admin/stats')
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export async function fetchSATenants() {
  return saFetch<SATenant[]>('/api/super-admin/tenants')
}

export async function fetchSATenantDetail(id: string) {
  return saFetch<SATenantDetail>(`/api/super-admin/tenants/${id}`)
}

export async function createSATenant(data: {
  name: string; subdomain: string; plan: string; userLimit: number
  trialEndsAt: string | null; adminName: string; adminEmail: string
}) {
  return saFetch<{ tenant: SATenant; adminEmail: string; tempPassword: string }>(
    '/api/super-admin/tenants',
    { method: 'POST', body: JSON.stringify(data) }
  )
}

export async function updateSATenant(id: string, data: {
  plan?: string; userLimit?: number; status?: string
}) {
  return saFetch<SATenant>(
    `/api/super-admin/tenants/${id}`,
    { method: 'PUT', body: JSON.stringify(data) }
  )
}

export async function exportSATenantCSV(id: string): Promise<string> {
  return saFetch<string>(`/api/super-admin/tenants/${id}/export`)
}

export async function deleteSATenant(id: string) {
  return saFetch<{ deleted: boolean }>(`/api/super-admin/tenants/${id}`, { method: 'DELETE' })
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function searchSAUsers(email: string) {
  return saFetch<SAUser[]>(`/api/super-admin/users/search?email=${encodeURIComponent(email)}`)
}

export async function resetSAUserPassword(userId: string, tempPassword: string) {
  return saFetch<{ updated: boolean; tempPassword: string }>(
    `/api/super-admin/users/${userId}/password`,
    { method: 'PUT', body: JSON.stringify({ tempPassword }) }
  )
}
```

- [ ] **Step 2: Create Zustand store for SA auth**

```typescript
// frontend/src/store/superAdminStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { saTokenStorage } from '@/services/saService'

interface SAAdmin {
  adminId:     string
  email:       string
  displayName: string
}

interface SuperAdminState {
  admin:      SAAdmin | null
  isLoggedIn: boolean
  login:  (token: string, admin: SAAdmin) => void
  logout: () => void
}

export const useSuperAdminStore = create<SuperAdminState>()(
  persist(
    (set) => ({
      admin:      null,
      isLoggedIn: false,

      login: (token, admin) => {
        saTokenStorage.set(token)
        set({ admin, isLoggedIn: true })
      },

      logout: () => {
        saTokenStorage.clear()
        set({ admin: null, isLoggedIn: false })
      },
    }),
    {
      name:    'dok_sa_auth',
      partialize: (state) => ({ admin: state.admin, isLoggedIn: state.isLoggedIn }),
    }
  )
)
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/saService.ts frontend/src/store/superAdminStore.ts
git commit -m "feat: add SA service and Zustand store"
```

---

## Task 13: SALogin + SALayout + SAAuthGuard

**Files:**
- Create: `frontend/src/components/auth/SAAuthGuard.tsx`
- Create: `frontend/src/pages/superadmin/SALogin.tsx`
- Create: `frontend/src/pages/superadmin/SALayout.tsx`

- [ ] **Step 1: Create SAAuthGuard**

```typescript
// frontend/src/components/auth/SAAuthGuard.tsx
import { Navigate } from 'react-router-dom'
import { useSuperAdminStore } from '@/store/superAdminStore'

export function SAAuthGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useSuperAdminStore(s => s.isLoggedIn)
  if (!isLoggedIn) return <Navigate to="/superadmin/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 2: Create SALogin page**

```typescript
// frontend/src/pages/superadmin/SALogin.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saLogin } from '@/services/saService'
import { useSuperAdminStore } from '@/store/superAdminStore'

export function SALogin() {
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [error,     setError]     = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useSuperAdminStore()
  const navigate  = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const { token, admin } = await saLogin(email, password)
      login(token, admin)
      navigate('/superadmin/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-blue-600 rounded-full">
              <Shield className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl text-white">DOK Super Admin</CardTitle>
          <p className="text-sm text-slate-400">Internal access only</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@dokcrm.com"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded p-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Create SALayout**

```typescript
// frontend/src/pages/superadmin/SALayout.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Shield, LayoutDashboard, Building2, Users, LogOut } from 'lucide-react'
import { useSuperAdminStore } from '@/store/superAdminStore'
import { cn } from '@/lib/utils/cn'

const NAV_ITEMS = [
  { to: '/superadmin/',        label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/superadmin/tenants', label: 'Tenants',   icon: Building2 },
  { to: '/superadmin/users',   label: 'Users',     icon: Users },
]

export function SALayout() {
  const { admin, logout } = useSuperAdminStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/superadmin/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="p-1.5 bg-blue-600 rounded">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Super Admin</p>
            <p className="text-[10px] text-slate-400 truncate">{admin?.email}</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-950 text-white">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/SAAuthGuard.tsx \
        frontend/src/pages/superadmin/SALogin.tsx \
        frontend/src/pages/superadmin/SALayout.tsx
git commit -m "feat: add SAAuthGuard, SALogin, SALayout"
```

---

## Task 14: App.tsx — Add Superadmin Route Tree

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add SA imports and routes to App.tsx**

Add these imports at the top of `frontend/src/App.tsx` with the existing imports:

```typescript
import { SAAuthGuard }         from '@/components/auth/SAAuthGuard'
import { SALogin }             from '@/pages/superadmin/SALogin'
import { SALayout }            from '@/pages/superadmin/SALayout'
import { SADashboard }         from '@/pages/superadmin/SADashboard'
import { SATenantsPage }       from '@/pages/superadmin/SATenantsPage'
import { SATenantDetailPage }  from '@/pages/superadmin/SATenantDetailPage'
import { SAUsersPage }         from '@/pages/superadmin/SAUsersPage'
```

Add these routes inside `<Routes>` just BEFORE the `<Route path="*" ...>` catch-all:

```typescript
{/* Super Admin — completely separate route tree */}
<Route path="/superadmin/login" element={<SALogin />} />
<Route
  path="/superadmin"
  element={
    <SAAuthGuard>
      <SALayout />
    </SAAuthGuard>
  }
>
  <Route index          element={<SADashboard />} />
  <Route path="tenants" element={<SATenantsPage />} />
  <Route path="tenants/:id" element={<SATenantDetailPage />} />
  <Route path="users"   element={<SAUsersPage />} />
</Route>
```

**Note:** The 4 SA page components don't exist yet — they'll be created in Tasks 15–18. TypeScript will error until all 4 are created. Continue to next tasks first, then run the TS check.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add superadmin route tree to App.tsx"
```

---

## Task 15: SADashboard

**Files:**
- Create: `frontend/src/pages/superadmin/SADashboard.tsx`

- [ ] **Step 1: Create the dashboard page**

```typescript
// frontend/src/pages/superadmin/SADashboard.tsx
import { useEffect, useState } from 'react'
import { Building2, Users, TrendingUp, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fetchSAStats, SAStats } from '@/services/saService'
import { formatCurrency } from '@/lib/utils/formatters'

const PLAN_LABELS: Record<string, string> = {
  starter:    'Starter',
  business:   'Business',
  enterprise: 'Enterprise',
}

const PLAN_COLORS: Record<string, string> = {
  starter:    'bg-slate-700 text-slate-200',
  business:   'bg-blue-800 text-blue-200',
  enterprise: 'bg-purple-800 text-purple-200',
}

export function SADashboard() {
  const [stats,     setStats]     = useState<SAStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    fetchSAStats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  )

  if (error) return (
    <div className="p-8 text-red-400">{error}</div>
  )

  if (!stats) return null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm">System-wide overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Active Tenants</span>
              <Building2 className="h-4 w-4 text-green-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.activeTenants}</p>
            {stats.suspendedTenants > 0 && (
              <p className="text-xs text-red-400 mt-1">{stats.suspendedTenants} suspended</p>
            )}
            {stats.trialTenants > 0 && (
              <p className="text-xs text-yellow-400">{stats.trialTenants} on trial</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Total Users</span>
              <Users className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
            <p className="text-xs text-slate-500 mt-1">across all tenants</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">New This Month</span>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
            <p className="text-3xl font-bold text-white">{stats.newThisMonth}</p>
            <p className="text-xs text-slate-500 mt-1">new tenants</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Est. MRR</span>
              <AlertCircle className="h-4 w-4 text-yellow-400" />
            </div>
            <p className="text-3xl font-bold text-white">
              ${stats.estimatedMRR.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">USD / month</p>
          </CardContent>
        </Card>
      </div>

      {/* Plan breakdown */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6">
          <h3 className="text-white font-medium mb-4">Tenants by Plan</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.planCounts).map(([plan, count]) => (
              <div key={plan} className="flex items-center gap-2 bg-slate-800 rounded-lg px-4 py-3">
                <Badge className={PLAN_COLORS[plan] || 'bg-slate-700'}>
                  {PLAN_LABELS[plan] || plan}
                </Badge>
                <span className="text-2xl font-bold text-white">{count}</span>
              </div>
            ))}
            {Object.keys(stats.planCounts).length === 0 && (
              <p className="text-slate-500 text-sm">No active tenants yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: Only errors for missing SATenantsPage, SATenantDetailPage, SAUsersPage (not created yet)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/superadmin/SADashboard.tsx
git commit -m "feat: add SADashboard with stats cards"
```

---

## Task 16: SATenantsPage + SACreateTenantModal

**Files:**
- Create: `frontend/src/pages/superadmin/SATenantsPage.tsx`
- Create: `frontend/src/pages/superadmin/SACreateTenantModal.tsx`

- [ ] **Step 1: Create SACreateTenantModal**

```typescript
// frontend/src/pages/superadmin/SACreateTenantModal.tsx
import { useState } from 'react'
import { Check, Copy, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { createSATenant, SATenant } from '@/services/saService'

interface Props {
  onClose:   () => void
  onCreated: (tenant: SATenant) => void
}

interface FormData {
  name:        string
  subdomain:   string
  plan:        string
  userLimit:   string
  trialEndsAt: string
  adminName:   string
  adminEmail:  string
}

interface CreatedResult {
  tenant:      SATenant
  adminEmail:  string
  tempPassword: string
}

export function SACreateTenantModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormData>({
    name: '', subdomain: '', plan: 'starter', userLimit: '3',
    trialEndsAt: '', adminName: '', adminEmail: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState('')
  const [result,    setResult]    = useState<CreatedResult | null>(null)
  const [copied,    setCopied]    = useState(false)

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      const res = await createSATenant({
        name:        form.name,
        subdomain:   form.subdomain,
        plan:        form.plan,
        userLimit:   Number(form.userLimit),
        trialEndsAt: form.trialEndsAt || null,
        adminName:   form.adminName,
        adminEmail:  form.adminEmail,
      })
      setResult(res)
      onCreated(res.tenant)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant')
    } finally {
      setIsLoading(false)
    }
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(result!.tempPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">
            {result ? 'Tenant Created' : 'New Tenant'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          /* ── Success Screen ── */
          <div className="p-5 space-y-4">
            <div className="bg-green-950 border border-green-800 rounded-lg p-4">
              <p className="text-green-400 font-medium mb-1">Tenant created successfully!</p>
              <p className="text-sm text-slate-400">Share these credentials with your client.</p>
            </div>

            <div className="space-y-3 bg-slate-800 rounded-lg p-4 text-sm">
              <div>
                <span className="text-slate-400">Company:</span>
                <span className="text-white ml-2 font-medium">{result.tenant.name}</span>
              </div>
              <div>
                <span className="text-slate-400">Subdomain:</span>
                <span className="text-white ml-2 font-mono">{result.tenant.subdomain}</span>
              </div>
              <div>
                <span className="text-slate-400">Login Email:</span>
                <span className="text-white ml-2">{result.adminEmail}</span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-slate-400">Temp Password:</span>
                  <span className="text-white ml-2 font-mono font-bold">{result.tempPassword}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyPassword}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <p className="text-xs text-yellow-400">
              The password will not be shown again. Copy it now.
            </p>

            <Button onClick={onClose} className="w-full bg-blue-600 hover:bg-blue-700">
              Done
            </Button>
          </div>
        ) : (
          /* ── Create Form ── */
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Company Name</Label>
                <Input value={form.name} onChange={set('name')}
                  placeholder="Acme Corp"
                  className="bg-slate-800 border-slate-700 text-white text-sm" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Subdomain</Label>
                <Input value={form.subdomain} onChange={set('subdomain')}
                  placeholder="acme"
                  className="bg-slate-800 border-slate-700 text-white text-sm font-mono" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Plan</Label>
                <Select value={form.plan} onValueChange={v => setForm(f => ({ ...f, plan: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="starter">Starter (3 users)</SelectItem>
                    <SelectItem value="business">Business (10 users)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (unlimited)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">User Limit</Label>
                <Input type="number" value={form.userLimit} onChange={set('userLimit')}
                  min={1} className="bg-slate-800 border-slate-700 text-white text-sm" required />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-slate-300 text-sm">Trial Ends (optional)</Label>
                <Input type="date" value={form.trialEndsAt} onChange={set('trialEndsAt')}
                  className="bg-slate-800 border-slate-700 text-white text-sm" />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 space-y-3">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                First Admin User
              </p>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Admin Name</Label>
                <Input value={form.adminName} onChange={set('adminName')}
                  placeholder="John Silva"
                  className="bg-slate-800 border-slate-700 text-white text-sm" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">Admin Email</Label>
                <Input type="email" value={form.adminEmail} onChange={set('adminEmail')}
                  placeholder="john@acme.com"
                  className="bg-slate-800 border-slate-700 text-white text-sm" required />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded p-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}
                className="flex-1 text-slate-400 hover:bg-slate-800">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Tenant
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create SATenantsPage**

```typescript
// frontend/src/pages/superadmin/SATenantsPage.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fetchSATenants, SATenant } from '@/services/saService'
import { SACreateTenantModal } from './SACreateTenantModal'

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-green-800 text-green-200',
  suspended: 'bg-red-800 text-red-200',
  cancelled: 'bg-slate-700 text-slate-300',
}

const PLAN_BADGE: Record<string, string> = {
  starter:    'bg-slate-700 text-slate-300',
  business:   'bg-blue-800 text-blue-200',
  enterprise: 'bg-purple-800 text-purple-200',
}

export function SATenantsPage() {
  const [tenants,     setTenants]     = useState<SATenant[]>([])
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState('')
  const [showCreate,  setShowCreate]  = useState(false)
  const navigate = useNavigate()

  const load = () => {
    setIsLoading(true)
    fetchSATenants()
      .then(setTenants)
      .catch(e => setError(e.message))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreated = (tenant: SATenant) => {
    setTenants(prev => [{ ...tenant, userCount: 1, leadCount: 0 }, ...prev])
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 text-sm">{tenants.length} companies</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          New Tenant
        </Button>
      </div>

      {error && <p className="text-red-400">{error}</p>}

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Company</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Subdomain</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Plan</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Users</th>
                  <th className="text-center py-3 px-4 text-slate-400 font-medium">Leads</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium">Created</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => navigate(`/superadmin/tenants/${t.id}`)}
                  >
                    <td className="py-3 px-4 font-medium text-white">{t.name}</td>
                    <td className="py-3 px-4 text-slate-400 font-mono text-xs">{t.subdomain}</td>
                    <td className="py-3 px-4">
                      <Badge className={PLAN_BADGE[t.plan] || ''}>{t.plan}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">{t.userCount}</td>
                    <td className="py-3 px-4 text-center text-slate-300">{t.leadCount}</td>
                    <td className="py-3 px-4">
                      <Badge className={STATUS_BADGE[t.status] || ''}>{t.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </td>
                  </tr>
                ))}
                {tenants.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No tenants yet. Create your first tenant.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showCreate && (
        <SACreateTenantModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: Only missing SATenantDetailPage and SAUsersPage errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/superadmin/SATenantsPage.tsx \
        frontend/src/pages/superadmin/SACreateTenantModal.tsx
git commit -m "feat: add SATenantsPage and SACreateTenantModal"
```

---

## Task 17: SATenantDetailPage

**Files:**
- Create: `frontend/src/pages/superadmin/SATenantDetailPage.tsx`

- [ ] **Step 1: Create the detail page**

```typescript
// frontend/src/pages/superadmin/SATenantDetailPage.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Trash2, Loader2, UserCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  fetchSATenantDetail, updateSATenant, exportSATenantCSV,
  deleteSATenant, SATenantDetail,
} from '@/services/saService'
import { toast } from 'sonner'

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-green-800 text-green-200',
  suspended: 'bg-red-800 text-red-200',
  cancelled: 'bg-slate-700 text-slate-300',
}

export function SATenantDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [detail,      setDetail]      = useState<SATenantDetail | null>(null)
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState('')
  const [showDelete,  setShowDelete]  = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [isDeleting,  setIsDeleting]  = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (!id) return
    fetchSATenantDetail(id)
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [id])

  const handleSuspend = async () => {
    if (!detail || !id) return
    const newStatus = detail.tenant.status === 'active' ? 'suspended' : 'active'
    try {
      await updateSATenant(id, { status: newStatus })
      setDetail(d => d ? { ...d, tenant: { ...d.tenant, status: newStatus as 'active' | 'suspended' | 'cancelled' } } : d)
      toast.success(newStatus === 'suspended' ? 'Tenant suspended' : 'Tenant reactivated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update')
    }
  }

  const handleExport = async () => {
    if (!id) return
    setIsExporting(true)
    try {
      const blobUrl = await exportSATenantCSV(id)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${detail?.tenant.subdomain}-export.csv`
      a.click()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      toast.error('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDelete = async () => {
    if (!id || deleteInput !== detail?.tenant.subdomain) return
    setIsDeleting(true)
    try {
      await deleteSATenant(id)
      toast.success('Tenant deleted')
      navigate('/superadmin/tenants')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
      setIsDeleting(false)
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  )
  if (error)  return <div className="p-8 text-red-400">{error}</div>
  if (!detail) return null

  const { tenant, users, stats, config } = detail
  const isSuspended = tenant.status === 'suspended'

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/superadmin/tenants')}
          className="text-slate-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
          <p className="text-slate-400 text-sm font-mono">{tenant.subdomain}</p>
        </div>
        <Badge className={STATUS_BADGE[tenant.status] || ''}>{tenant.status}</Badge>
      </div>

      {/* Info + Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-base">Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ['Plan',       tenant.plan],
              ['User Limit', String(tenant.userLimit)],
              ['Owner',      tenant.ownerEmail],
              ['Created',    new Date(tenant.createdAt).toLocaleDateString()],
              ['Trial Ends', tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-400">{label}</span>
                <span className="text-white">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader><CardTitle className="text-white text-base">Stats</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ['Total Users',      String(users.length)],
              ['Active Leads',     String(stats.leadCount)],
              ['Activities',       String(stats.activityCount)],
              ['Pipeline Stages',  config ? String(config.stageNames.length) : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-400">{label}</span>
                <span className="text-white font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button
          variant="outline"
          onClick={handleSuspend}
          className={isSuspended
            ? 'border-green-700 text-green-400 hover:bg-green-950'
            : 'border-yellow-700 text-yellow-400 hover:bg-yellow-950'}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          {isSuspended ? 'Reactivate Tenant' : 'Suspend Tenant'}
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={isExporting}
          className="border-slate-600 text-slate-300 hover:bg-slate-800">
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          Export CSV
        </Button>
        <Button variant="outline" onClick={() => setShowDelete(true)}
          className="border-red-800 text-red-400 hover:bg-red-950">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Tenant
        </Button>
      </div>

      {/* Users Table */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader><CardTitle className="text-white text-base">Users ({users.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                {['Name','Email','Role','Last Login'].map(h => (
                  <th key={h} className="text-left py-2 px-4 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-800">
                  <td className="py-2 px-4 text-white flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-slate-500" />{u.displayName}
                  </td>
                  <td className="py-2 px-4 text-slate-400">{u.email}</td>
                  <td className="py-2 px-4">
                    <Badge className={u.role === 'admin' ? 'bg-blue-800 text-blue-200' : 'bg-slate-700 text-slate-300'}>
                      {u.role}
                    </Badge>
                  </td>
                  <td className="py-2 px-4 text-slate-500 text-xs">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Delete Modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-red-800 rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Delete Tenant</h3>

            <div className="bg-red-950 border border-red-800 rounded p-3 text-sm text-red-300 space-y-1">
              <p className="font-medium">This will permanently delete:</p>
              <ul className="list-disc list-inside space-y-0.5 text-red-400">
                <li>{stats.leadCount} leads</li>
                <li>{users.length} users</li>
                <li>{stats.activityCount} activities</li>
                <li>All tenant configuration</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                Download data before deleting?
              </p>
              <Button variant="outline" onClick={handleExport} disabled={isExporting}
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-800">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Download CSV First
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-slate-400">
                Type <span className="font-mono text-white">{tenant.subdomain}</span> to confirm:
              </p>
              <Input
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder={tenant.subdomain}
                className="bg-slate-800 border-slate-700 text-white font-mono"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setShowDelete(false); setDeleteInput('') }}
                className="flex-1 text-slate-400 hover:bg-slate-800">
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteInput !== tenant.subdomain || isDeleting}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Delete Forever
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: Only missing SAUsersPage error

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/superadmin/SATenantDetailPage.tsx
git commit -m "feat: add SATenantDetailPage with suspend/export/delete flows"
```

---

## Task 18: SAUsersPage + Final Verification

**Files:**
- Create: `frontend/src/pages/superadmin/SAUsersPage.tsx`

- [ ] **Step 1: Create SAUsersPage**

```typescript
// frontend/src/pages/superadmin/SAUsersPage.tsx
import { useState } from 'react'
import { Search, Loader2, Check, Copy, KeyRound, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { searchSAUsers, resetSAUserPassword, SAUser } from '@/services/saService'
import { toast } from 'sonner'

interface ResetModal {
  user:         SAUser
  tempPassword: string
  result:       string | null
}

export function SAUsersPage() {
  const [searchTerm,  setSearchTerm]  = useState('')
  const [users,       setUsers]       = useState<SAUser[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searched,    setSearched]    = useState(false)
  const [resetModal,  setResetModal]  = useState<ResetModal | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const [copied,      setCopied]      = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTerm.trim().length < 2) return
    setIsSearching(true)
    setSearched(false)
    try {
      const results = await searchSAUsers(searchTerm)
      setUsers(results)
      setSearched(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetModal || !resetModal.tempPassword) return
    setIsResetting(true)
    try {
      const res = await resetSAUserPassword(resetModal.user.id, resetModal.tempPassword)
      setResetModal(m => m ? { ...m, result: res.tempPassword } : null)
      toast.success('Password reset successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setIsResetting(false)
    }
  }

  const copyResult = () => {
    if (resetModal?.result) {
      navigator.clipboard.writeText(resetModal.result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <p className="text-slate-400 text-sm">Search any user across all tenants</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-3 max-w-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by email..."
            className="pl-10 bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <Button type="submit" disabled={isSearching} className="bg-blue-600 hover:bg-blue-700">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
        </Button>
      </form>

      {/* Results */}
      {searched && (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Name','Email','Role','Tenant','Last Login',''].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-slate-400 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-3 px-4 text-white">{u.displayName}</td>
                    <td className="py-3 px-4 text-slate-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <Badge className={u.role === 'admin' ? 'bg-blue-800 text-blue-200' : 'bg-slate-700 text-slate-300'}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      <span className="font-medium text-white">{u.tenantName}</span>
                      <span className="text-xs ml-1 text-slate-500 font-mono">({u.subdomain})</span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-xs">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResetModal({ user: u, tempPassword: '', result: null })}
                        className="border-slate-600 text-slate-300 hover:bg-slate-800"
                      >
                        <KeyRound className="h-3 w-3 mr-1" />
                        Reset PW
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No users found for "{searchTerm}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Reset Password</h3>
              <button onClick={() => setResetModal(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-800 rounded p-3 text-sm">
              <p className="text-slate-400">User</p>
              <p className="text-white font-medium">{resetModal.user.displayName}</p>
              <p className="text-slate-400 text-xs">{resetModal.user.email} · {resetModal.user.tenantName}</p>
            </div>

            {resetModal.result ? (
              /* ── Success ── */
              <div className="space-y-3">
                <p className="text-sm text-green-400">Password updated successfully.</p>
                <div className="flex items-center justify-between bg-slate-800 rounded p-3">
                  <div>
                    <p className="text-xs text-slate-400">New Temp Password</p>
                    <p className="text-white font-mono font-bold">{resetModal.result}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={copyResult}
                    className="text-slate-400 hover:text-white">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-yellow-400">Share this with the user — it won't be shown again.</p>
                <Button onClick={() => setResetModal(null)} className="w-full bg-blue-600 hover:bg-blue-700">
                  Done
                </Button>
              </div>
            ) : (
              /* ── Form ── */
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300 text-sm">New Temporary Password</Label>
                  <Input
                    value={resetModal.tempPassword}
                    onChange={e => setResetModal(m => m ? { ...m, tempPassword: e.target.value } : null)}
                    placeholder="Min 6 characters"
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setResetModal(null)}
                    className="flex-1 text-slate-400 hover:bg-slate-800">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleResetPassword}
                    disabled={resetModal.tempPassword.length < 6 || isResetting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Set Password
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Full TypeScript check — both frontend and backend**

```bash
cd frontend && npx tsc --noEmit 2>&1; echo "Frontend: $?"
cd ../backend && npx tsc --noEmit 2>&1; echo "Backend: $?"
```

Expected:
```
Frontend: 0
Backend: 0
```

- [ ] **Step 3: Start both servers and verify end-to-end**

Terminal 1 — backend:
```bash
cd backend && npm run dev
```

Terminal 2 — frontend:
```bash
cd frontend && npm run dev
```

Browser checklist:
- [ ] Navigate to `http://localhost:3000/superadmin/login`
- [ ] Login with super admin credentials → redirects to `/superadmin/`
- [ ] Dashboard shows stats cards
- [ ] Tenants page shows table
- [ ] Click `+ New Tenant` → fill form → submit → success screen shows temp password
- [ ] Click new tenant row → detail page loads with users + stats
- [ ] Suspend tenant → status badge changes to red
- [ ] Navigate to Users → search an email → Reset Password flow works
- [ ] Navigate to `http://localhost:3000/login` (tenant CRM) → still works normally
- [ ] Try accessing `/superadmin/` without SA login → redirects to `/superadmin/login`

- [ ] **Step 4: Final commit**

```bash
git add frontend/src/pages/superadmin/SAUsersPage.tsx
git commit -m "feat: add SAUsersPage with cross-tenant user search and password reset"
```

---

## Phase 3 Complete — Summary

### What was built
| Area | Files |
|------|-------|
| Database | `011_create_dok_admins.sql` |
| Backend models | `dokAdminModel.ts` |
| Backend middleware | `superAdminAuth.ts` + `requireAuth.ts` (Option C) |
| Backend controllers | `superAdminController.ts` (10 handlers) |
| Backend routes | `superAdmin.ts` + `routes/index.ts` |
| Setup script | `scripts/createSuperAdmin.ts` |
| Frontend service | `saService.ts` |
| Frontend store | `superAdminStore.ts` |
| Frontend pages | `SALogin`, `SALayout`, `SAAuthGuard`, `SADashboard`, `SATenantsPage`, `SACreateTenantModal`, `SATenantDetailPage`, `SAUsersPage` |
| Frontend routing | `App.tsx` |

### First-time setup commands (run once after deployment)
```bash
# 1. Run migration
Get-Content backend\migrations\011_create_dok_admins.sql | docker exec -i dokcrm_postgres psql -U dokcrm -d dokcrm

# 2. Create super admin account
cd backend && npm run create-superadmin

# 3. Access panel
# http://localhost:3000/superadmin/login
```
