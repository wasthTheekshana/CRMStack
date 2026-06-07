CREATE TABLE IF NOT EXISTS saved_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  filters    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_views_tenant_user ON saved_views(tenant_id, user_id);
