-- ============================================================
-- 007_create_triggers.sql
-- PL/pgSQL function + triggers for auto-updating updated_at
-- Must run after 002, 005, 006 tables are created
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at            ON leads;
DROP TRIGGER IF EXISTS sales_targets_updated_at    ON sales_targets;
DROP TRIGGER IF EXISTS dashboard_settings_updated_at ON dashboard_settings;

CREATE TRIGGER leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER sales_targets_updated_at
    BEFORE UPDATE ON sales_targets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER dashboard_settings_updated_at
    BEFORE UPDATE ON dashboard_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
