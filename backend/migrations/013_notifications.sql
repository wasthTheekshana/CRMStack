-- ============================================================
-- 013_notifications.sql
-- Creates the notifications table for in-app notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  type         VARCHAR(64)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  body         TEXT         NOT NULL,
  link         VARCHAR(255),
  read_at      TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_tenant ON notifications (user_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id   ON notifications (tenant_id);
