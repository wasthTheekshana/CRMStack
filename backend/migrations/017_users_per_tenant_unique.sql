-- ============================================================
-- 017_users_per_tenant_unique.sql
-- Scope email and username uniqueness per tenant instead of
-- globally, so different companies can share the same email
-- or username without conflicting.
-- ============================================================

-- Drop the global unique constraints added in 001_create_users.sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key;

-- Re-add as composite unique constraints scoped to tenant
ALTER TABLE users ADD CONSTRAINT users_email_tenant_unique    UNIQUE (email,    tenant_id);
ALTER TABLE users ADD CONSTRAINT users_username_tenant_unique UNIQUE (username, tenant_id);
