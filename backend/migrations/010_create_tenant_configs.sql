-- ============================================================
-- 010_create_tenant_configs.sql
-- Per-tenant configuration: stages, solutions, custom fields,
-- visible fields, and branding.
-- Phase 2: Per-Tenant Customization
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_configs (
  tenant_id      UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  sales_stages   JSONB NOT NULL DEFAULT '[]',
  solutions      JSONB NOT NULL DEFAULT '[]',
  custom_fields  JSONB NOT NULL DEFAULT '[]',
  visible_fields JSONB NOT NULL DEFAULT '{}',
  branding       JSONB NOT NULL DEFAULT '{}',
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the default DOK tenant config with existing hardcoded values
INSERT INTO tenant_configs (tenant_id, sales_stages, solutions, custom_fields, visible_fields, branding)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  '[
    {"id":"s1","name":"On Hold",         "color":"#F97316","probability":10, "order":0,"isWon":false},
    {"id":"s2","name":"Meeting Pending", "color":"#3B82F6","probability":25, "order":1,"isWon":false},
    {"id":"s3","name":"Proposal Sent",   "color":"#8B5CF6","probability":50, "order":2,"isWon":false},
    {"id":"s4","name":"Negotiated",      "color":"#A855F7","probability":75, "order":3,"isWon":false},
    {"id":"s5","name":"Verbal Yes",      "color":"#EC4899","probability":90, "order":4,"isWon":false},
    {"id":"s6","name":"Closed & Won",    "color":"#22C55E","probability":100,"order":5,"isWon":true}
  ]'::jsonb,
  '[
    {"id":"p1","name":"Document Management"},
    {"id":"p2","name":"Workflow Automation"},
    {"id":"p3","name":"Digital Archiving"},
    {"id":"p4","name":"Records Management"},
    {"id":"p5","name":"Business Process Management"},
    {"id":"p6","name":"Other"}
  ]'::jsonb,
  '[]'::jsonb,
  '{"imageCount":true,"boxCount":true,"hoUpdate":true,"probability":true,"remarks":true}'::jsonb,
  '{"companyName":"DOK","primaryColor":"#3B82F6"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_configs WHERE tenant_id = 'a0000000-0000-0000-0000-000000000001'
);
