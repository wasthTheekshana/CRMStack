import { apiFetch } from '@/config/api'

export interface SalesStageConfig {
  id:          string
  name:        string
  color:       string
  probability: number
  order:       number
  isWon:       boolean
}

export interface SolutionConfig {
  id:   string
  name: string
}

export interface FieldConfig {
  id:         string
  name:       string
  type:       'text' | 'number' | 'select' | 'date' | 'checkbox' | 'formula'
  required:   boolean
  options:    string[]
  group?:     string
  order:      number
  formula?:   string
  precision?: number
  prefix?:    string
  suffix?:    string
}

export type CustomFieldConfig = FieldConfig

export interface FieldGroup {
  id:         string
  name:       string
  order:      number
  collapsed?: boolean
}

export interface DashboardWidget {
  id:              string
  name:            string
  type:            'sum' | 'average' | 'count' | 'min' | 'max' | 'group_by'
  field_id:        string
  group_by_field?: string
  chart_type:      'number' | 'bar' | 'pie' | 'table'
  order:           number
  role:            'admin' | 'sales' | 'both'
}

export interface CoreFieldVisibility {
  probability?: boolean
}

export interface BrandingConfig {
  companyName?:  string
  logoUrl?:      string
  primaryColor?: string
  faviconUrl?:   string
}

export interface TenantConfig {
  tenantId:             string
  salesStages:          SalesStageConfig[]
  solutions:            SolutionConfig[]
  customFields:         FieldConfig[]
  visibleFields:        Record<string, boolean>
  fieldGroups:          FieldGroup[]
  dashboardWidgets:     DashboardWidget[]
  coreFieldVisibility:  CoreFieldVisibility
  branding:             BrandingConfig
}

export async function fetchTenantConfig(): Promise<TenantConfig> {
  return apiFetch<TenantConfig>('/api/tenant/config')
}

export async function saveTenantConfig(data: Partial<Omit<TenantConfig, 'tenantId'>>): Promise<TenantConfig> {
  return apiFetch<TenantConfig>('/api/tenant/config', {
    method: 'PUT',
    body:   JSON.stringify(data),
  })
}
