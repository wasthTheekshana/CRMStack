import { create } from 'zustand'
import { DashboardSettings } from '@/types'

// Default settings - all visible
export const defaultDashboardSettings: DashboardSettings = {
  kpiCards: {
    companies: true,
    totalLeads: true,
    activeDeals: true,
    totalRevenue: true,
    weighted: true,
    grossProfit: true,
  },
  sections: {
    pipelineByStage: true,
    revenueBySolution: true,
    opportunityHeatmap: true,
    topCustomers: true,
    recentActivities: true,
    revenueByStage: true,
    revenueForecasting: true,
    teamTotalsByStage: true,
  },
  navigation: {
    salesTargets: true,
    quarterlyTargets: true,
  },
}

// Saved settings can be missing keys: the server returns empty objects for a user who
// has never saved, and settings saved before a card/section existed lack its key.
// Filling the gaps from the defaults means a missing key can never hide a card, section
// or menu item; an explicit `false` the user saved still wins.
export function mergeWithDefaultSettings(
  saved: Partial<DashboardSettings> | null | undefined
): DashboardSettings {
  return {
    kpiCards: { ...defaultDashboardSettings.kpiCards, ...(saved?.kpiCards ?? {}) },
    sections: { ...defaultDashboardSettings.sections, ...(saved?.sections ?? {}) },
    navigation: {
      salesTargets: true,
      quarterlyTargets: true,
      ...(saved?.navigation ?? {}),
    },
  }
}

interface DashboardStore {
  settings: DashboardSettings
  isCustomizing: boolean
  isLoading: boolean
  setSettings: (settings: DashboardSettings) => void
  updateKpiCard: (key: keyof DashboardSettings['kpiCards'], value: boolean) => void
  updateSection: (key: keyof DashboardSettings['sections'], value: boolean) => void
  updateNavigation: (key: keyof NonNullable<DashboardSettings['navigation']>, value: boolean) => void
  toggleCustomizing: () => void
  setIsLoading: (loading: boolean) => void
  resetToDefault: () => void
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  settings: defaultDashboardSettings,
  isCustomizing: false,
  isLoading: false,

  setSettings: (settings) => set({ settings: mergeWithDefaultSettings(settings) }),

  updateKpiCard: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        kpiCards: {
          ...state.settings.kpiCards,
          [key]: value,
        },
      },
    })),

  updateSection: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        sections: {
          ...state.settings.sections,
          [key]: value,
        },
      },
    })),

  updateNavigation: (key, value) =>
    set((state) => ({
      settings: {
        ...state.settings,
        navigation: {
          salesTargets: state.settings.navigation?.salesTargets ?? true,
          quarterlyTargets: state.settings.navigation?.quarterlyTargets ?? true,
          [key]: value,
        },
      },
    })),

  toggleCustomizing: () => set((state) => ({ isCustomizing: !state.isCustomizing })),

  setIsLoading: (loading) => set({ isLoading: loading }),

  resetToDefault: () => set({ settings: defaultDashboardSettings }),
}))
