-- ============================================================
-- 008_create_tenants.sql
-- Tenants table — one row per customer company
-- Phase 1: Multi-Tenant Architecture
-- ============================================================

CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  subdomain     VARCHAR(100) NOT NULL UNIQUE,
  plan          VARCHAR(20)  NOT NULL DEFAULT 'starter'
                    CHECK (plan IN ('starter', 'business', 'enterprise')),
  status        VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'cancelled')),
  user_limit    INTEGER NOT NULL DEFAULT 3,
  owner_email   VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at  TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status    ON tenants(status);

-- Seed a default development tenant for existing local data
INSERT INTO tenants (id, name, subdomain, plan, status, user_limit, owner_email)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  'DOK (Default)',
  'dok',
  'enterprise',
  'active',
  100,
  'dokadmin@gmail.com'
WHERE NOT EXISTS (
  SELECT 1 FROM tenants WHERE subdomain = 'dok'
);
