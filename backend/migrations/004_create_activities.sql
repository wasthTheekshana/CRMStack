-- ============================================================
-- 004_create_activities.sql
-- Activities table — replaces Firestore 'activities' collection
-- Immutable after insert (no UPDATE allowed — enforced in API)
-- ============================================================

CREATE TABLE IF NOT EXISTS activities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID REFERENCES leads(id) ON DELETE SET NULL,
    type        VARCHAR(50) NOT NULL
                    CHECK (type IN ('note', 'stage_change', 'call', 'email', 'meeting')),
    description TEXT NOT NULL,
    metadata    JSONB,                              -- flexible extra data
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_owner_id   ON activities(owner_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id    ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
