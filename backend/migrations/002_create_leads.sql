-- ============================================================
-- 002_create_leads.sql
-- Leads table — replaces Firestore 'leads' collection
-- contacts stored as JSONB array (mirrors current Firestore structure)
-- ============================================================

CREATE TABLE IF NOT EXISTS leads (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name     VARCHAR(500) NOT NULL,
    solution         VARCHAR(255) NOT NULL,
    contacts         JSONB NOT NULL DEFAULT '[]',   -- array of Contact objects
    sales_stage      VARCHAR(100) NOT NULL
                         CHECK (sales_stage IN (
                             'On Hold',
                             'Meeting Pending',
                             'Proposal Sent',
                             'Negotiated',
                             'Verbal Yes',
                             'Closed & Won'
                         )),
    image_count      INTEGER NOT NULL DEFAULT 0,
    box_count        INTEGER NOT NULL DEFAULT 0,
    estimated_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
    probability      INTEGER NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
    remarks          TEXT,
    ho_update        TEXT,
    position         INTEGER,                        -- kanban column ordering
    owner_id         UUID NOT NULL REFERENCES users(id),
    owner_email      VARCHAR(255) NOT NULL,
    is_deleted       BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_owner_id    ON leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_leads_sales_stage ON leads(sales_stage);
CREATE INDEX IF NOT EXISTS idx_leads_is_deleted  ON leads(is_deleted);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at  ON leads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_created_at  ON leads(created_at DESC);

-- Trigger is defined in 007_create_triggers.sql
