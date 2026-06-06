# DOK CRM — Commercial Readiness Roadmap

> What needs to be **built**, **changed**, and **removed** before going commercial.
> Based on current system state and Standard Plan requirements.

---

## Current System Status

| Area | Current State | Commercial Ready? |
|------|--------------|------------------|
| CRM core (pipeline, leads) | ✅ Done | ✅ Yes |
| Role-based access (admin/sales) | ✅ Done | ✅ Yes |
| Analytics & reports | ✅ Done | ✅ Yes |
| Sales targets | ✅ Done | ✅ Yes |
| Soft delete / deleted leads | ✅ Done | ✅ Yes |
| Database | Firebase Firestore | ❌ Must migrate to PostgreSQL |
| Hosting | Firebase Hosting | ❌ Must move to Google Cloud |
| Multi-tenant (multiple clients) | ❌ Single tenant only | ❌ Must build |
| Subscription & billing | ❌ Not built | ❌ Must build |
| License enforcement (user limits) | ❌ Not built | ❌ Must build |
| User self-management | ❌ Not built | ❌ Must build |
| Super admin panel (DOK internal) | ❌ Not built | ❌ Must build |
| Data export (CSV) | ❌ Not built | ❌ Must build |
| Email notifications | ❌ Not built | ⚠️ Important |
| Password reset (self-service) | ❌ Not built | ❌ Must build |
| Audit logs | ❌ Not built | ⚠️ Important |

---

## Phase 1 — Must Have Before First Commercial Client

> These are blockers. Cannot go commercial without these.

---

### 1. Database Migration — Firebase → PostgreSQL

**Current:** Data stored in Firebase Firestore (Google's NoSQL cloud DB)
**Change to:** PostgreSQL 15 on Google Cloud SQL

**Why change:**
- Firebase is per-document pricing — costs grow unpredictably with more clients
- PostgreSQL is free, powerful, and standard for commercial SaaS
- Multi-tenant schema isolation is clean and proven in PostgreSQL
- Full SQL queries for reporting and analytics

**What needs to be done:**
- [ ] Design PostgreSQL schema (leads, users, roles, tenants, targets, settings)
- [ ] Write data migration script (Firestore → PostgreSQL)
- [ ] Replace all Firebase SDK calls (`getDoc`, `onSnapshot`, `updateDoc`) with PostgreSQL API calls
- [ ] Replace Firestore real-time listeners with polling or WebSocket
- [ ] Migrate Firebase Auth → custom JWT auth OR keep Firebase Auth + PostgreSQL for data

**Files that will change:**
- `src/lib/firebase/collections.ts` — entire file rewritten
- `src/hooks/useLeads.ts` — replace onSnapshot with fetch/polling
- `src/hooks/useKPIs.ts` — replace with SQL aggregation queries
- `firestore.rules` — replaced by server-side authorization middleware
- `src/config/constants.ts` — remove Firebase config

---

### 2. Multi-Tenant Architecture

**Current:** Single company uses the system — no concept of "tenants"
**Change to:** Each client company is a separate tenant with isolated data

**What needs to be done:**
- [ ] Add `tenant_id` to every database table
- [ ] Create tenant management system (create, suspend, delete tenants)
- [ ] Subdomain routing — `clientname.dokcrm.com` → loads correct tenant data
- [ ] Nginx config for wildcard subdomain routing
- [ ] Tenant context in all API calls (every query filters by tenant_id)
- [ ] Prevent any data leaking between tenants

**New database tables needed:**
```
tenants          — id, name, subdomain, plan, status, created_at
tenant_users     — tenant_id, user_id, role
subscriptions    — tenant_id, plan, status, billing_date, user_limit
```

---

### 3. License Enforcement (User Limit per Plan)

**Current:** Admin can create unlimited users — no restriction
**Change to:** Standard plan = 5 users max. Extra users charged at LKR 3,000/user

**What needs to be done:**
- [ ] Track user count per tenant in database
- [ ] Block adding new user if tenant is at user limit
- [ ] Show clear message: "User limit reached. Add license (LKR 3,000/user) to continue."
- [ ] Admin panel shows current user count vs plan limit

**Where to add:**
- `src/pages/admin/TeamManagement` — add user limit check before creating user
- New API endpoint: `POST /api/users` with license validation

---

### 4. Super Admin Panel (DOK Internal)

**Current:** No way for DOK team to manage client companies from one place
**New:** DOK super admin dashboard — separate login, separate URL

**Features needed:**
- [ ] Login as DOK super admin (separate from client admin)
- [ ] View all tenants (clients) — name, subdomain, plan, user count, status
- [ ] Create new tenant (onboard new client)
- [ ] Suspend / reactivate tenant
- [ ] Delete tenant + export their data
- [ ] View each tenant's user list
- [ ] Reset any user's password
- [ ] View infrastructure usage per tenant

**Suggested URL:** `admin.dokcrm.com` (separate from client subdomains)

---

### 5. Self-Service Password Reset

**Current:** If a user forgets password, they must contact DOK — no self-service
**Change to:** "Forgot Password" link on login page → email with reset link

**What needs to be done:**
- [ ] Add "Forgot Password?" link to login page
- [ ] Create password reset page (`/reset-password?token=xxx`)
- [ ] Send reset email with time-limited token (expires in 1 hour)
- [ ] Email sending service — use SendGrid or AWS SES (~LKR 1,000/month)

**Files that will change:**
- `src/pages/auth/LoginPage.tsx` — add forgot password link
- New page: `src/pages/auth/ForgotPasswordPage.tsx`
- New page: `src/pages/auth/ResetPasswordPage.tsx`
- New backend endpoint: `POST /api/auth/forgot-password`
- New backend endpoint: `POST /api/auth/reset-password`

---

### 6. Data Export — CSV / Excel

**Current:** No way to export leads or reports — data is locked inside the system
**Change to:** Export button on Leads page and Reports page

**What needs to be done:**
- [ ] Export all leads to CSV (with filters — date range, stage, owner)
- [ ] Export analytics report summary to CSV
- [ ] Download button visible to admin on Leads and Reports pages

**Files that will change:**
- `src/pages/shared/LeadsPage.tsx` — add Export CSV button
- `src/pages/shared/ReportsPage.tsx` — add Export button
- New utility: `src/lib/exportCSV.ts`

---

### 7. Hosting Migration — Firebase → Google Cloud Docker

**Current:** Deployed on Firebase Hosting (static file hosting)
**Change to:** Google Cloud Compute Engine VM with Docker

**What needs to be done:**
- [ ] Set up GCP Compute Engine VM (e2-standard-2, Mumbai region)
- [ ] Install Docker + Docker Compose on VM
- [ ] Create `Dockerfile` for DOK CRM app
- [ ] Create `docker-compose.yml` (Nginx + App + Certbot)
- [ ] Set up Cloud SQL PostgreSQL instance
- [ ] Configure Nginx for wildcard subdomain routing
- [ ] Set up SSL certificate (Let's Encrypt wildcard `*.dokcrm.com`)
- [ ] Set up Cloud Storage bucket for backups
- [ ] Configure daily backup cron job
- [ ] Set up UptimeRobot monitoring

**New files needed:**
- `Dockerfile`
- `docker-compose.yml`
- `nginx/conf.d/dokcrm.conf`
- `scripts/backup.sh`
- `scripts/create-tenant.sh`

---

## Phase 2 — Important, Build After First Client

> These improve the product significantly but are not blockers for launch.

---

### 8. Email Notifications

**Current:** No email alerts — users must manually check the system
**Add:** Automated email alerts for key events

| Notification | Trigger | Sent To |
|-------------|---------|---------|
| New lead assigned | Lead created and assigned to rep | Sales rep |
| Lead stage changed | Deal moved to new stage | Lead owner |
| Lead deleted | Lead soft-deleted | Admin |
| Monthly summary | 1st of each month | Admin |
| Account created | New user added | New user (with temp password) |
| Password reset | Reset requested | User |

**Service:** SendGrid Free tier (100 emails/day free) or AWS SES

---

### 9. Lead Import — CSV Upload

**Current:** Leads must be entered one by one manually
**Add:** Bulk import from CSV/Excel file

**What needs to be done:**
- [ ] CSV upload button on Leads page
- [ ] Map CSV columns to lead fields
- [ ] Validate data before import (show errors)
- [ ] Import progress indicator
- [ ] Handle duplicates (skip or update)

**Useful for:** New clients migrating from spreadsheets or old CRM

---

### 10. Activity Log per Lead

**Current:** No history — if a lead is edited, old values are lost
**Add:** Activity timeline inside each lead/deal modal

**Shows:**
- Stage changes with timestamp and who changed it
- Field edits (what changed from → to)
- Comments/notes added by team
- When lead was deleted/restored

**New database table:**
```
lead_activities — id, lead_id, tenant_id, user_id, action, old_value, new_value, created_at
```

---

### 11. In-App Notifications

**Current:** No notification system — users have no alerts inside the app
**Add:** Notification bell icon in top navigation

**Shows:**
- Lead assigned to you
- Lead stage changed by admin
- System announcements from DOK

---

### 12. Audit Log (Admin View)

**Current:** No record of who did what — no accountability trail
**Add:** Audit log page for admin

**Tracks:**
- User login/logout with IP and timestamp
- Lead created, edited, deleted — by whom
- User accounts created or deactivated
- Settings changes

**Important for:** Enterprise clients, compliance, accountability

---

## Phase 3 — Nice to Have (Future Growth)

> Build these when client base grows or clients request them.

---

### 13. Mobile Responsive Improvements

**Current:** App works on mobile but not optimized — some tables overflow
**Improve:** Full mobile-friendly layout for sales reps on the go

---

### 14. Two-Factor Authentication (2FA)

**Current:** Login is email + password only
**Add:** Optional 2FA via authenticator app (Google Authenticator)

**Important for:** Business tier clients with sensitive sales data

---

### 15. API Access

**Current:** No external API — data is only accessible through the UI
**Add:** REST API with API key authentication

**Useful for:** Business tier clients who want to connect DOK CRM to their own tools (ERP, accounting software, etc.)

---

### 16. Custom Branding (White-Label)

**Current:** DOK CRM branding everywhere
**Add:** Option for client to use their own logo and company name in the system

**Charge:** One-time setup fee (LKR 25,000) + included in Business tier

---

### 17. Lead Notes & Attachments

**Current:** No notes or file attachments on leads
**Add:** Notes text field per lead + file upload (PDF quotations, contracts)

**Storage:** Google Cloud Storage bucket (per tenant folder)

---

## Summary — What Changes vs What Stays

### Stays the Same (No Change Needed)
- All UI components and pages (Kanban, Dashboard, Analytics, Reports)
- All chart components (FunnelChart, RepComparison, BubbleChart)
- Role logic (admin vs sales rep views)
- Sales stages and probability system
- KPI cards and calculations
- Deleted leads feature
- Sales targets feature

### Must Be Changed
| Item | From | To |
|------|------|----|
| Database | Firebase Firestore | PostgreSQL 15 (Cloud SQL) |
| Hosting | Firebase Hosting | Google Cloud Docker VM |
| Data access layer | Firebase SDK | REST API + PostgreSQL queries |
| Real-time updates | Firestore `onSnapshot` | Polling or WebSocket |
| Security rules | `firestore.rules` | Server-side middleware (JWT) |
| Auth (data only) | Firebase Auth | Keep Firebase Auth OR custom JWT |

### Must Be Built (New)
- Multi-tenant system
- Super admin panel (DOK internal)
- License enforcement
- Self-service password reset
- Data export (CSV)
- Email notifications
- Super admin tenant management scripts
- Docker + Nginx deployment config
- Backup automation scripts

---

## Recommended Build Order

```
Week 1–2   →  PostgreSQL schema design + database migration
Week 3–4   →  Multi-tenant architecture + subdomain routing
Week 5     →  License enforcement + user limit logic
Week 6     →  Super admin panel (DOK internal)
Week 7     →  Password reset + email service setup
Week 8     →  Google Cloud VM + Docker deployment + SSL
Week 9     →  Testing with first internal client (DOK Group)
Week 10    →  CSV export + go-live with first commercial client
────────────────────────────────────────────────────────────
After launch:  Email notifications, CSV import, activity logs
Later:         2FA, API access, mobile improvements, white-label
```

---

*DOK Technology Team — March 2026*
*Review and update this document after each development sprint.*
