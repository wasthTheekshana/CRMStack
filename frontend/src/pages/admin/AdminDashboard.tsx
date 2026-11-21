import { useState, useEffect, useMemo } from 'react'
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Loader2,
  Filter,
  Coins,
} from 'lucide-react'
import { KPICard } from '@/components/dashboard/KPICard'
import { TopCustomers } from '@/components/dashboard/TopCustomers'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { DashboardCustomizer } from '@/components/dashboard/DashboardCustomizer'
import { RevenueForecast } from '@/components/dashboard/RevenueForecast'
import { CustomWidgets } from '@/components/dashboard/CustomWidgets'
import { PipelineChart } from '@/components/charts/PipelineChart'
import { SolutionPieChart } from '@/components/charts/SolutionPieChart'
import { BubbleChart } from '@/components/charts/BubbleChart'
import { useLeads } from '@/hooks/useLeads'
import {
  useKPIs,
  useGrossProfit,
  useStageData,
  useSolutionData,
  useTopCustomers,
  useTeamMemberStageKpi,
  TeamMemberStagePeriod,
} from '@/hooks/useKPIs'
import { useDashboardStore } from '@/store/dashboardStore'
import { useSalesStages, useCustomFields } from '@/store/tenantStore'
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters'
import { getSalesUsers } from '@/lib/api/collections'
import { User } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CategoryFilter, categoryLabel } from '@/components/leads/CategoryFilter'
import { ALL_CATEGORIES, findCategoryField, isLeadInCategory } from '@/lib/utils/leadFilters'

export function AdminDashboard() {
  const { leads, isLoading } = useLeads()
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('all')
  const { settings } = useDashboardStore()
  const salesStages = useSalesStages()
  const cfConfigs = useCustomFields()
  // When the workspace has a "Category" dropdown field it replaces the sales-rep filter.
  const categoryField = useMemo(() => findCategoryField(cfConfigs), [cfConfigs])
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES)
  const [teamKpiStage, setTeamKpiStage] = useState<string>('')
  const [teamKpiPeriod, setTeamKpiPeriod] = useState<TeamMemberStagePeriod>('last_month')

  // Fetch sales users on mount
  useEffect(() => {
    const fetchSalesUsers = async () => {
      try {
        const users = await getSalesUsers()
        setSalesUsers(users)
      } catch (error) {
        console.error('Error fetching sales users:', error)
      }
    }
    fetchSalesUsers()
  }, [])

  // Filter leads by the selected category (or, without a Category field, the salesperson)
  const filteredLeads = useMemo(() => {
    return leads.filter(lead =>
      (selectedSalesPerson === 'all' || lead.ownerId === selectedSalesPerson) &&
      isLeadInCategory(lead, categoryField, categoryFilter)
    )
  }, [leads, selectedSalesPerson, categoryField, categoryFilter])

  // Get selected salesperson name for display
  const selectedSalesPersonName = useMemo(() => {
    if (selectedSalesPerson === 'all') return 'All Sales Reps'
    const user = salesUsers.find(u => u.uid === selectedSalesPerson)
    return user?.displayName || 'Unknown'
  }, [selectedSalesPerson, salesUsers])

  // Calculate KPIs and data based on filtered leads
  const kpis = useKPIs(filteredLeads)
  const grossProfit = useGrossProfit(filteredLeads)
  const stageData = useStageData(filteredLeads)
  const solutionData = useSolutionData(filteredLeads)
  const topCustomers = useTopCustomers(filteredLeads)

  // Default the team KPI stage selector to the first configured stage, and fall back
  // to it again if the previously selected stage was renamed/deleted out from under us
  // (otherwise effectiveTeamKpiStage would point at a stage no longer in salesStages,
  // leaving the dropdown blank and the table silently empty).
  const selectedStageStillValid = salesStages.some(s => s.name === teamKpiStage)
  const effectiveTeamKpiStage = selectedStageStillValid ? teamKpiStage : (salesStages[0]?.name || '')
  // Respects the same rep filter as the rest of the dashboard (filteredLeads), rather
  // than aggregating every rep regardless of the "Filter by rep" selection above.
  const teamMemberStageTotals = useTeamMemberStageKpi(
    filteredLeads,
    salesUsers,
    effectiveTeamKpiStage,
    teamKpiPeriod,
    cfConfigs
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Check if any KPI cards are visible
  // Gross Profit is shown only if the workspace has that field, and (since older saved
  // settings don't have the key) it counts as visible unless explicitly switched off.
  const showGrossProfit = grossProfit.available && settings.kpiCards.grossProfit !== false
  const { grossProfit: _grossProfitSetting, ...baseKpiSettings } = settings.kpiCards
  const hasVisibleKpis = Object.values(baseKpiSettings).some(Boolean) || showGrossProfit

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of all sales activities and performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {categoryField ? (
            <CategoryFilter field={categoryField} value={categoryFilter} onChange={setCategoryFilter} />
          ) : (
            /* Salesperson Filter (only for workspaces without a Category field) */
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedSalesPerson} onValueChange={setSelectedSalesPerson}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sales Reps</SelectItem>
                  {salesUsers.map((user) => (
                    <SelectItem key={user.uid} value={user.uid}>
                      {user.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DashboardCustomizer />
        </div>
      </div>

      {/* Active Filter Badge */}
      {(selectedSalesPerson !== 'all' || (categoryField && categoryFilter !== ALL_CATEGORIES)) && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            Showing: {categoryField ? categoryLabel(categoryFilter) : selectedSalesPersonName}
          </Badge>
          <button
            onClick={() => { setSelectedSalesPerson('all'); setCategoryFilter(ALL_CATEGORIES) }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* KPI Cards - responsive grid */}
      {hasVisibleKpis && (
        <div
          className={`grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 ${
            showGrossProfit ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
          }`}
        >
          {settings.kpiCards.companies && (
            <KPICard
              title="Companies"
              value={kpis.totalCompanies}
              icon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
              colorScheme="blue"
            />
          )}
          {settings.kpiCards.totalLeads && (
            <KPICard
              title="Total Leads"
              value={kpis.totalLeads}
              icon={<Users className="h-5 w-5 md:h-6 md:w-6" />}
              colorScheme="green"
            />
          )}
          {settings.kpiCards.activeDeals && (
            <KPICard
              title="Active Deals"
              value={kpis.activeDeals}
              icon={<Target className="h-5 w-5 md:h-6 md:w-6" />}
              colorScheme="purple"
            />
          )}
          {settings.kpiCards.totalRevenue && (
            <KPICard
              title="Total Revenue"
              value={formatCompactNumber(kpis.totalRevenue)}
              subtitle={formatCurrency(kpis.totalRevenue)}
              icon={<DollarSign className="h-5 w-5 md:h-6 md:w-6" />}
              colorScheme="orange"
            />
          )}
          {settings.kpiCards.weighted && (
            <KPICard
              title="Weighted"
              value={formatCompactNumber(kpis.weightedRevenue)}
              subtitle={`${kpis.avgProbability.toFixed(0)}% avg`}
              icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6" />}
              colorScheme="green"
            />
          )}
          {showGrossProfit && (
            <KPICard
              title="Gross Profit"
              value={formatCompactNumber(grossProfit.total)}
              subtitle={formatCurrency(grossProfit.total)}
              icon={<Coins className="h-5 w-5 md:h-6 md:w-6" />}
              colorScheme="purple"
            />
          )}
        </div>
      )}

      {/* Charts Row 1 */}
      {(settings.sections.pipelineByStage || settings.sections.revenueBySolution) && (
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          {settings.sections.pipelineByStage && (
            <PipelineChart data={stageData} title="Pipeline by Stage" />
          )}
          {settings.sections.revenueBySolution && (
            <SolutionPieChart data={solutionData} title="Revenue by Solution" />
          )}
        </div>
      )}

      {/* Charts Row 2 */}
      {(settings.sections.opportunityHeatmap || settings.sections.topCustomers) && (
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
          {settings.sections.opportunityHeatmap && (
            <div className={settings.sections.topCustomers ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <BubbleChart leads={filteredLeads} title="Opportunity Heatmap" />
            </div>
          )}
          {settings.sections.topCustomers && <TopCustomers customers={topCustomers} />}
        </div>
      )}

      {/* Activities */}
      {(settings.sections.recentActivities || settings.sections.revenueByStage) && (
        <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
          {settings.sections.recentActivities && <RecentActivities />}
          {settings.sections.revenueByStage && (
            <PipelineChart
              data={stageData}
              title="Revenue by Stage"
              showRevenue={true}
            />
          )}
        </div>
      )}

      {/* Revenue Forecasting */}
      {settings.sections.revenueForecasting && (
        <RevenueForecast leads={filteredLeads} />
      )}

      {/* Team Member Totals by Stage */}
      {(settings.sections.teamTotalsByStage ?? true) && (
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base font-semibold">Team Totals by Stage</h2>
          <div className="flex items-center gap-2">
            <Select value={effectiveTeamKpiStage} onValueChange={setTeamKpiStage}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Stage" />
              </SelectTrigger>
              <SelectContent>
                {salesStages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.name}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={teamKpiPeriod}
              onValueChange={(v) => setTeamKpiPeriod(v as TeamMemberStagePeriod)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_week">Last Week</SelectItem>
                <SelectItem value="last_month">Last Month</SelectItem>
                <SelectItem value="last_two_months">Last 2 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {teamMemberStageTotals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No leads created by any team member in this stage for the selected period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-4 font-medium">Team Member</th>
                  <th className="py-2 pr-4 font-medium text-right">Total Price</th>
                  <th className="py-2 font-medium text-right">Leads</th>
                </tr>
              </thead>
              <tbody>
                {teamMemberStageTotals.map((row) => (
                  <tr key={row.ownerId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{row.ownerName}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(row.totalPrice)}</td>
                    <td className="py-2 text-right">{row.leadCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Custom Analytics */}
      <CustomWidgets />
    </div>
  )
}
