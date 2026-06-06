# DB Migration: Firebase → PostgreSQL (Local First)

> **Strategy:** Run everything locally using Docker before touching any cloud.
> Cloud migration starts ONLY after local is 100% working and tested.

---

## Progress Legend
- ✅ Done
- 🔄 In Progress
- ⬜ Not Started

---

## Phase A — Local Infrastructure Setup

| # | Task | Status | Notes |
|---|------|--------|-------|
| A1 | Create `docker-compose.yml` with PostgreSQL 15 | ✅ | Port 5432, local volume `dokcrm_postgres_data` |
| A2 | Create `backend/.env` DB credentials | ✅ | DB_URL, JWT_SECRET configured |
| A3 | Run `docker compose up -d` — verify DB is running | ⬜ | **YOU DO THIS** |
| A4 | Connect to PostgreSQL locally — confirm access | ⬜ | Use DBeaver or `psql -h localhost -U dokcrm -d dokcrm` |

---

## Phase B — Database Schema Design

| # | Task | Status | Notes |
|---|------|--------|-------|
| B1 | `backend/migrations/001_create_users.sql` | ✅ | users table |
| B2 | `backend/migrations/002_create_leads.sql` | ✅ | leads + JSONB contacts + auto updated_at trigger |
| B3 | `backend/migrations/003_create_tasks.sql` | ✅ | tasks table |
| B4 | `backend/migrations/004_create_activities.sql` | ✅ | activities table (immutable) |
| B5 | `backend/migrations/005_create_sales_targets.sql` | ✅ | sales_targets with unique constraint |
| B6 | `backend/migrations/006_create_settings.sql` | ✅ | dashboard_settings JSONB |
| B7 | Run migrations: `cd backend && npm install && npm run migrate` | ⬜ | **YOU DO THIS** |

---

## Phase C — Backend API Server (Node.js + Express + TypeScript)

| # | Task | Status | Notes |
|---|------|--------|-------|
| C1 | `backend/` folder, `package.json`, `tsconfig.json` | ✅ | Express + pg + bcrypt + JWT |
| C2 | DB connection pool `backend/src/lib/db.ts` | ✅ | node-postgres pool |
| C3 | JWT auth middleware `backend/src/middleware/auth.ts` | ✅ | requireAuth + requireAdmin |
| C4 | `POST /api/auth/login` + `GET /api/auth/me` | ✅ | JWT token auth |
| C5 | Users routes — GET all, GET by id, POST, PUT | ✅ | `backend/src/routes/users.ts` |
| C6 | Leads routes — GET, POST, PUT, DELETE (soft), restore | ✅ | `backend/src/routes/leads.ts` |
| C7 | Tasks routes — GET, POST, PUT, DELETE | ✅ | `backend/src/routes/tasks.ts` |
| C8 | Activities routes — GET, POST (immutable) | ✅ | `backend/src/routes/activities.ts` |
| C9 | Sales Targets routes — GET, POST, PUT, DELETE | ✅ | `backend/src/routes/salesTargets.ts` |
| C10 | Settings routes — GET, PUT (upsert) | ✅ | `backend/src/routes/settings.ts` |
| C11 | KPIs route — SQL aggregation | ✅ | `backend/src/routes/kpis.ts` |
| C12 | Main server `backend/src/index.ts` | ✅ | Port 4000, CORS for :3000 |
| C13 | Start backend: `cd backend && npm run dev` | ⬜ | **YOU DO THIS** |

---

## Phase D — Frontend: Replace Firebase with API Calls

| # | Task | Status | Notes |
|---|------|--------|-------|
| D1 | `src/config/api.ts` — base URL + JWT fetch wrapper | ✅ | Replaces `src/config/firebase.ts` |
| D2 | `src/lib/api/collections.ts` — all CRUD via REST API | ✅ | Replaces `src/lib/firebase/collections.ts` |
| D3 | `src/hooks/useLeads.ts` — removed `onSnapshot`, uses polling (30s) | ✅ | |
| D4 | `src/hooks/useKPIs.ts` — no change needed (pure computation) | ✅ | No Firebase dependency found |
| D5 | `src/store/authStore.ts` — JWT token auth replacing Firebase Auth | ✅ | `tokenStorage` in localStorage |
| D6 | `.env.local` — `VITE_API_URL=http://localhost:4000` | ✅ | Firebase vars commented out |
| D7 | Check remaining Firebase imports in other pages/components | ⬜ | Run: `grep -r "firebase" src/` |

---

## Phase E — Data Migration (Firestore → PostgreSQL)

| # | Task | Status | Notes |
|---|------|--------|-------|
| E1 | `scripts/migrate-firestore-to-pg.ts` | ✅ | Idempotent — safe to re-run |
| E2 | Run migration: `npx tsx scripts/migrate-firestore-to-pg.ts` | ⬜ | **YOU DO THIS** after DB is up |
| E3 | Verify data — check row counts in each table | ⬜ | |
| E4 | Spot check 3–5 leads data matches Firestore | ⬜ | |

> **Note:** Migrated users get password `ChangeMe@123` — must reset on first login.

---

## Phase F — End-to-End Testing (Local)

| # | Task | Status | Notes |
|---|------|--------|-------|
| F1 | Login with admin user — verify JWT works | ⬜ | |
| F2 | Login with sales user — verify role restrictions | ⬜ | |
| F3 | Create a new lead — verify saved to PostgreSQL | ⬜ | |
| F4 | Move lead stage (Kanban drag) — verify update in DB | ⬜ | |
| F5 | Delete lead (soft delete) — verify in deleted leads | ⬜ | |
| F6 | Restore deleted lead — verify restored | ⬜ | |
| F7 | Admin Dashboard KPIs — verify correct calculations | ⬜ | |
| F8 | Analytics charts — verify all charts load correctly | ⬜ | |
| F9 | Reports page — verify CSV export works | ⬜ | |
| F10 | Team Management — create/edit/delete user | ⬜ | |
| F11 | Sales Targets — create/update targets | ⬜ | |
| F12 | Dashboard customizer — verify settings persist | ⬜ | |

---

## Next Steps — What YOU need to run now

```bash
# Step 1 — Start PostgreSQL (Docker)
docker compose up -d

# Step 2 — Install backend dependencies & run migrations
cd backend
npm install
npm run migrate

# Step 3 — Start backend API
npm run dev
# Should see: DOK CRM Backend running on http://localhost:4000

# Step 4 — In a new terminal, start frontend
cd ..
npm run dev
# Should see: http://localhost:3000

# Step 5 — Migrate existing Firestore data (optional — skip if starting fresh)
npx tsx scripts/migrate-firestore-to-pg.ts
```

---

## Cloud Migration (STARTS ONLY AFTER Phase F is 100% Done)

> Do not touch cloud infrastructure until all local tests pass.
> Cloud steps are defined in `DOK_CRM_COMMERCIAL_ROADMAP.md`

---

*Last updated: March 21, 2026*
