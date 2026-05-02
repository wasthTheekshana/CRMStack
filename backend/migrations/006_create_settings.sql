-- ============================================================
-- 006_create_settings.sql
-- Dashboard settings — replaces Firestore 'settings' collection
-- ============================================================

CREATE TABLE IF NOT EXISTS dashboard_settings (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    kpi_cards   JSONB NOT NULL DEFAULT '{
        "companies": true,
        "totalLeads": true,
        "activeDeals": true,
        "totalRevenue": true,
        "weighted": true
    }',
    sections    JSONB NOT NULL DEFAULT '{
        "pipelineByStage": true,
        "revenueBySolution": true,
        "opportunityHeatmap": true,
        "topCustomers": true,
        "recentActivities": true,
        "revenueByStage": true,
        "revenueForecasting": true
    }',
    navigation  JSONB NOT NULL DEFAULT '{
        "salesTargets": true,
        "quarterlyTargets": true
    }',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger is defined in 007_create_triggers.sql
