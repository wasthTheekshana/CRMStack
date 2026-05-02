-- ============================================================
-- 003_create_tasks.sql
-- Tasks table — replaces Firestore 'tasks' collection
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID REFERENCES leads(id) ON DELETE SET NULL,
    title       VARCHAR(500) NOT NULL,
    description TEXT,
    type        VARCHAR(50) NOT NULL
                    CHECK (type IN ('call', 'email', 'meeting', 'follow-up', 'other')),
    due_date    TIMESTAMPTZ NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'overdue')),
    priority    VARCHAR(20) NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_id  ON tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id   ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date  ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);
