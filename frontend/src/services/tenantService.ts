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

export interface CustomFieldConfig {
  id:       string
  name:     string
  type:     'text' | 'number' | 'select' | 'date' | 'checkbox'
  required: boolean
  options:  string[]
}

export interface BrandingConfig {
  companyName?:  string
  logoUrl?:      string
  primaryColor?: string
  faviconUrl?:   string
}

export interface TenantConfig {
  tenantId:      string
  salesStages:   SalesStageConfig[]
  solutions:     SolutionConfig[]
  customFields:  CustomFieldConfig[]
  visibleFields: Record<string, boolean>
  branding:      BrandingConfig
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
