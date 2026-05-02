-- ============================================================
-- 005_create_sales_targets.sql
-- Sales targets — replaces Firestore 'salesTargets' collection
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_targets (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year         INTEGER NOT NULL,
    month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    target       NUMERIC(15,2) NOT NULL DEFAULT 0,
    achievement  NUMERIC(15,2) NOT NULL DEFAULT 0,
    owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    owner_email  VARCHAR(255) NOT NULL,
    owner_name   VARCHAR(255) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (year, month, owner_id)               -- one target per person per month
);

CREATE INDEX IF NOT EXISTS idx_sales_targets_owner_id   ON sales_targets(owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_targets_year_month ON sales_targets(year, month);

-- Trigger is defined in 007_create_triggers.sql
