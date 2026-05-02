-- ============================================================
-- 009_add_tenant_id.sql
-- Add tenant_id to all existing tables for multi-tenancy
-- Also removes hardcoded sales_stage CHECK constraint so
-- each tenant can define custom pipeline stages (Phase 2).
-- Phase 1: Multi-Tenant Architecture
-- ============================================================

-- ── users ────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Assign all existing users to the default dev tenant
UPDATE users SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- ── leads ────────────────────────────────────────────────────
-- Drop the hardcoded sales_stage CHECK constraint so tenants
-- can use their own custom stage names (enforced at app level).
ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_sales_stage_check;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);

-- Assign all existing leads to the default dev tenant
UPDATE leads SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- ── tasks ────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_id ON tasks(tenant_id);

UPDATE tasks SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- ── activities ───────────────────────────────────────────────
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_activities_tenant_id ON activities(tenant_id);

UPDATE activities SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- ── sales_targets ────────────────────────────────────────────
ALTER TABLE sales_targets
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sales_targets_tenant_id ON sales_targets(tenant_id);

UPDATE sales_targets SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;

-- ── dashboard_settings ───────────────────────────────────────
ALTER TABLE dashboard_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_dashboard_settings_tenant_id ON dashboard_settings(tenant_id);

UPDATE dashboard_settings SET tenant_id = 'a0000000-0000-0000-0000-000000000001'
WHERE tenant_id IS NULL;
