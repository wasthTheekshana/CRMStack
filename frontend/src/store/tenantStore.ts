import { create } from 'zustand'
import {
  fetchTenantConfig,
  saveTenantConfig,
  TenantConfig,
  SalesStageConfig,
  SolutionConfig,
  CustomFieldConfig,
  BrandingConfig,
} from '@/services/tenantService'

// Re-export types so components only need to import from this one place
export type {
  TenantConfig,
  SalesStageConfig,
  SolutionConfig,
  CustomFieldConfig,
  BrandingConfig,
}

interface TenantState {
  config:     TenantConfig | null
  isLoading:  boolean
  error:      string | null
  loadConfig: () => Promise<void>
  saveConfig: (data: Partial<Omit<TenantConfig, 'tenantId'>>) => Promise<void>
}

export const useTenantStore = create<TenantState>((set, get) => ({
  config:    null,
  isLoading: false,
  error:     null,

  loadConfig: async () => {
    if (get().config) return  // already loaded
    set({ isLoading: true, error: null })
    try {
      const config = await fetchTenantConfig()
      set({ config, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load config'
      set({ error: message, isLoading: false })
    }
  },

  saveConfig: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const config = await saveTenantConfig(data)
      set({ config, isLoading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save config'
      set({ error: message, isLoading: false })
      throw err
    }
  },
}))

// ─── Convenience selectors ────────────────────────────────────────────────────
export const useSalesStages    = () => useTenantStore(s => s.config?.salesStages   ?? [])
export const useSolutions      = () => useTenantStore(s => s.config?.solutions     ?? [])
export const useCustomFields   = () => useTenantStore(s => s.config?.customFields  ?? [])
export const useVisibleFields  = () => useTenantStore(s => s.config?.visibleFields ?? {})
export const useBranding       = () => useTenantStore(s => s.config?.branding      ?? {})

/** Returns the probability for a given stage name, or 25 as fallback */
export function useDefaultProbability() {
  const stages = useSalesStages()
  return (stageName: string): number =>
    stages.find(s => s.name === stageName)?.probability ?? 25
}

/** Returns the color for a given stage name */
export function useStageColor() {
  const stages = useSalesStages()
  return (stageName: string): string =>
    stages.find(s => s.name === stageName)?.color ?? '#6B7280'
}

/** Returns the Won stage name(s) */
export function useWonStages() {
  const stages = useSalesStages()
  return stages.filter(s => s.isWon).map(s => s.name)
}
