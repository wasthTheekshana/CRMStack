import { query } from '../config/db';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface SalesStageConfig {
  id:          string;
  name:        string;
  color:       string;
  probability: number;
  order:       number;
  isWon:       boolean;
}

export interface SolutionConfig {
  id:   string;
  name: string;
}

export interface FieldConfig {
  id:         string;
  name:       string;
  type:       'text' | 'textarea' | 'number' | 'select' | 'date' | 'checkbox' | 'formula';
  required:   boolean;
  options:    string[];
  group?:     string;
  order:      number;
  formula?:   string;
  precision?: number;
  prefix?:    string;
  suffix?:    string;
}

// Keep the old name as an alias so existing imports don't break during transition
export type CustomFieldConfig = FieldConfig;

export interface FieldGroup {
  id:         string;
  name:       string;
  order:      number;
  collapsed?: boolean;
}

export interface DashboardWidget {
  id:              string;
  name:            string;
  type:            'sum' | 'average' | 'count' | 'min' | 'max' | 'group_by';
  field_id:        string;
  group_by_field?: string;
  chart_type:      'number' | 'bar' | 'pie' | 'table';
  order:           number;
  role:            'admin' | 'sales' | 'both';
}

export interface CoreFieldVisibility {
  probability?: boolean;
}

export interface BrandingConfig {
  companyName?:  string;
  logoUrl?:      string;
  primaryColor?: string;
  faviconUrl?:   string;
}

export interface TenantConfig {
  tenantId:             string;
  salesStages:          SalesStageConfig[];
  solutions:            SolutionConfig[];
  customFields:         FieldConfig[];
  visibleFields:        Record<string, boolean>;  // deprecated, kept for migration
  fieldGroups:          FieldGroup[];
  dashboardWidgets:     DashboardWidget[];
  coreFieldVisibility:  CoreFieldVisibility;
  branding:             BrandingConfig;
  updatedAt:            Date | null;
}

// ─── Default config (used when no config row exists yet) ─────────────────────
export const DEFAULT_STAGES: SalesStageConfig[] = [
  { id: 's1', name: 'On Hold',         color: '#F97316', probability: 10,  order: 0, isWon: false },
  { id: 's2', name: 'Meeting Pending', color: '#3B82F6', probability: 25,  order: 1, isWon: false },
  { id: 's3', name: 'Proposal Sent',   color: '#8B5CF6', probability: 50,  order: 2, isWon: false },
  { id: 's4', name: 'Negotiated',      color: '#A855F7', probability: 75,  order: 3, isWon: false },
  { id: 's5', name: 'Verbal Yes',      color: '#EC4899', probability: 90,  order: 4, isWon: false },
  { id: 's6', name: 'Closed & Won',    color: '#22C55E', probability: 100, order: 5, isWon: true  },
];

export const DEFAULT_SOLUTIONS: SolutionConfig[] = [
  { id: 'p1', name: 'Document Management' },
  { id: 'p2', name: 'Workflow Automation' },
  { id: 'p3', name: 'Digital Archiving' },
  { id: 'p4', name: 'Records Management' },
  { id: 'p5', name: 'Business Process Management' },
  { id: 'p6', name: 'Other' },
];

// ─── Row → Client mapper ──────────────────────────────────────────────────────
export const mapConfig = (row: Record<string, unknown>): TenantConfig => ({
  tenantId:            row.tenant_id as string,
  salesStages:         (row.sales_stages  as SalesStageConfig[])          || DEFAULT_STAGES,
  solutions:           (row.solutions     as SolutionConfig[])            || DEFAULT_SOLUTIONS,
  customFields:        (row.custom_fields as FieldConfig[])               || [],
  visibleFields:       (row.visible_fields as Record<string, boolean>)    || {},
  fieldGroups:         (row.field_groups as FieldGroup[])                  || [],
  dashboardWidgets:    (row.dashboard_widgets as DashboardWidget[])       || [],
  coreFieldVisibility: (row.core_field_visibility as CoreFieldVisibility) || {},
  branding:            (row.branding      as BrandingConfig)              || {},
  updatedAt:           row.updated_at as Date | null,
});

// ─── Query functions ──────────────────────────────────────────────────────────
export async function findConfigByTenantId(tenantId: string): Promise<TenantConfig | null> {
  const result = await query(
    'SELECT * FROM tenant_configs WHERE tenant_id = $1',
    [tenantId]
  );
  return result.rows[0] ? mapConfig(result.rows[0]) : null;
}

export async function upsertConfig(tenantId: string, data: {
  salesStages?:         SalesStageConfig[];
  solutions?:           SolutionConfig[];
  customFields?:        FieldConfig[];
  visibleFields?:       Record<string, boolean>;
  fieldGroups?:         FieldGroup[];
  dashboardWidgets?:    DashboardWidget[];
  coreFieldVisibility?: CoreFieldVisibility;
  branding?:            BrandingConfig;
}): Promise<TenantConfig> {
  const result = await query(
    `INSERT INTO tenant_configs (tenant_id, sales_stages, solutions, custom_fields, visible_fields, field_groups, dashboard_widgets, core_field_visibility, branding)
     VALUES (
       $1,
       COALESCE($2::jsonb, '[]'::jsonb),
       COALESCE($3::jsonb, '[]'::jsonb),
       COALESCE($4::jsonb, '[]'::jsonb),
       COALESCE($5::jsonb, '{}'::jsonb),
       COALESCE($6::jsonb, '[]'::jsonb),
       COALESCE($7::jsonb, '[]'::jsonb),
       COALESCE($8::jsonb, '{}'::jsonb),
       COALESCE($9::jsonb, '{}'::jsonb)
     )
     ON CONFLICT (tenant_id) DO UPDATE SET
       sales_stages          = COALESCE($2::jsonb, tenant_configs.sales_stages),
       solutions             = COALESCE($3::jsonb, tenant_configs.solutions),
       custom_fields         = COALESCE($4::jsonb, tenant_configs.custom_fields),
       visible_fields        = COALESCE($5::jsonb, tenant_configs.visible_fields),
       field_groups           = COALESCE($6::jsonb, tenant_configs.field_groups),
       dashboard_widgets      = COALESCE($7::jsonb, tenant_configs.dashboard_widgets),
       core_field_visibility  = COALESCE($8::jsonb, tenant_configs.core_field_visibility),
       branding              = COALESCE($9::jsonb, tenant_configs.branding),
       updated_at            = NOW()
     RETURNING *`,
    [
      tenantId,
      data.salesStages          != null ? JSON.stringify(data.salesStages)         : null,
      data.solutions            != null ? JSON.stringify(data.solutions)           : null,
      data.customFields         != null ? JSON.stringify(data.customFields)        : null,
      data.visibleFields        != null ? JSON.stringify(data.visibleFields)       : null,
      data.fieldGroups          != null ? JSON.stringify(data.fieldGroups)         : null,
      data.dashboardWidgets     != null ? JSON.stringify(data.dashboardWidgets)    : null,
      data.coreFieldVisibility  != null ? JSON.stringify(data.coreFieldVisibility) : null,
      data.branding             != null ? JSON.stringify(data.branding)            : null,
    ]
  );
  return mapConfig(result.rows[0]);
}

/** Returns won stage names for a tenant — used by KPI controller */
export async function getWonStageNames(tenantId: string): Promise<string[]> {
  const config = await findConfigByTenantId(tenantId);
  const stages = config?.salesStages ?? DEFAULT_STAGES;
  return stages.filter(s => s.isWon).map(s => s.name);
}
