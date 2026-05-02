import { useEffect, useState } from 'react'
import {
  Settings,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  LayoutDashboard,
  BarChart3,
  Loader2,
  Navigation,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useDashboardStore, defaultDashboardSettings } from '@/store/dashboardStore'
import { useAuthStore } from '@/store/authStore'
import { getDashboardSettings, saveDashboardSettings } from '@/lib/api/collections'
import { DashboardSettings } from '@/types'

const KPI_LABELS: Record<keyof DashboardSettings['kpiCards'], string> = {
  companies: 'Companies',
  totalLeads: 'Total Leads',
  activeDeals: 'Active Deals',
  totalRevenue: 'Total Revenue',
  weighted: 'Weighted Revenue',
}

const SECTION_LABELS: Record<keyof DashboardSettings['sections'], string> = {
  pipelineByStage: 'Pipeline by Stage',
  revenueBySolution: 'Revenue by Solution',
  opportunityHeatmap: 'Opportunity Heatmap',
  topCustomers: 'Top Customers',
  recentActivities: 'Recent Activities',
  revenueByStage: 'Revenue by Stage',
  revenueForecasting: 'Revenue Forecasting',
}

const NAVIGATION_LABELS: Record<keyof NonNullable<DashboardSettings['navigation']>, string> = {
  salesTargets: 'Sales Targets',
  quarterlyTargets: 'Quarterly Targets (Admin)',
}

export function DashboardCustomizer() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { user } = useAuthStore()
  const {
    settings,
    setSettings,
    updateKpiCard,
    updateSection,
    updateNavigation,
    resetToDefault,
    isLoading,
    setIsLoading,
  } = useDashboardStore()

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      if (!user?.id) return
      setIsLoading(true)
      try {
        const savedSettings = await getDashboardSettings(user.id)
        if (savedSettings) {
          setSettings(savedSettings)
        }
      } catch (error) {
        console.error('Error loading dashboard settings:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [user?.id, setSettings, setIsLoading])

  const handleSave = async () => {
    if (!user?.id) return
    setIsSaving(true)
    try {
      await saveDashboardSettings(user.id, settings)
      setIsOpen(false)
    } catch (error) {
      console.error('Error saving dashboard settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async () => {
    if (!user?.id) return
    resetToDefault()
    setIsSaving(true)
    try {
      await saveDashboardSettings(user.id, defaultDashboardSettings)
    } catch (error) {
      console.error('Error resetting dashboard settings:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const visibleKpiCount = Object.values(settings.kpiCards).filter(Boolean).length
  const visibleSectionCount = Object.values(settings.sections).filter(Boolean).length
  const visibleNavigationCount = Object.values(settings.navigation || {}).filter(Boolean).length

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Customize</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Customize Dashboard
          </SheetTitle>
          <SheetDescription>
            Show or hide cards and sections on your dashboard. Changes are saved to your account.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-6">
            {/* KPI Cards Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    KPI Cards
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {visibleKpiCount}/{Object.keys(KPI_LABELS).length} visible
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(KPI_LABELS) as Array<keyof DashboardSettings['kpiCards']>).map(
                  (key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <Label
                        htmlFor={`kpi-${key}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        {settings.kpiCards[key] ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        {KPI_LABELS[key]}
                      </Label>
                      <Switch
                        id={`kpi-${key}`}
                        checked={settings.kpiCards[key]}
                        onCheckedChange={(checked: boolean) => updateKpiCard(key, checked)}
                      />
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Sections */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Charts & Sections
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {visibleSectionCount}/{Object.keys(SECTION_LABELS).length} visible
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(SECTION_LABELS) as Array<keyof DashboardSettings['sections']>).map(
                  (key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <Label
                        htmlFor={`section-${key}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        {settings.sections[key] ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        {SECTION_LABELS[key]}
                      </Label>
                      <Switch
                        id={`section-${key}`}
                        checked={settings.sections[key]}
                        onCheckedChange={(checked: boolean) => updateSection(key, checked)}
                      />
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Navigation Items */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Navigation className="h-4 w-4" />
                    Navigation Menu
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {visibleNavigationCount}/{Object.keys(NAVIGATION_LABELS).length} visible
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(Object.keys(NAVIGATION_LABELS) as Array<keyof NonNullable<DashboardSettings['navigation']>>).map(
                  (key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <Label
                        htmlFor={`nav-${key}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        {settings.navigation?.[key] !== false ? (
                          <Eye className="h-4 w-4 text-green-600" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        {NAVIGATION_LABELS[key]}
                      </Label>
                      <Switch
                        id={`nav-${key}`}
                        checked={settings.navigation?.[key] !== false}
                        onCheckedChange={(checked: boolean) => updateNavigation(key, checked)}
                      />
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isSaving}
                className="flex-1"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1">
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
