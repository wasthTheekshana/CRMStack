import { useState, useEffect, useMemo } from 'react'
import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Loader2,
  Filter,
} from 'lucide-react'
import { KPICard } from '@/components/dashboard/KPICard'
import { TopCustomers } from '@/components/dashboard/TopCustomers'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { DashboardCustomizer } from '@/components/dashboard/DashboardCustomizer'
import { RevenueForecast } from '@/components/dashboard/RevenueForecast'
import { PipelineChart } from '@/components/charts/PipelineChart'
import { SolutionPieChart } from '@/components/charts/SolutionPieChart'
import { BubbleChart } from '@/components/charts/BubbleChart'
import { useLeads } from '@/hooks/useLeads'
import { useKPIs, useStageData, useSolutionData, useTopCustomers } from '@/hooks/useKPIs'
import { useDashboardStore } from '@/store/dashboardStore'
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

export function AdminDashboard() {
  const { leads, isLoading } = useLeads()
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('all')
  const { settings } = useDashboardStore()

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

  // Filter leads by selected salesperson
  const filteredLeads = useMemo(() => {
    if (selectedSalesPerson === 'all') {
      return leads
    }
    return leads.filter(lead => lead.ownerId === selectedSalesPerson)
  }, [leads, selectedSalesPerson])

  // Get selected salesperson name for display
  const selectedSalesPersonName = useMemo(() => {
    if (selectedSalesPerson === 'all') return 'All Sales Reps'
    const user = salesUsers.find(u => u.uid === selectedSalesPerson)
    return user?.displayName || 'Unknown'
  }, [selectedSalesPerson, salesUsers])

  // Calculate KPIs and data based on filtered leads
  const kpis = useKPIs(filteredLeads)
  const stageData = useStageData(filteredLeads)
  const solutionData = useSolutionData(filteredLeads)
  const topCustomers = useTopCustomers(filteredLeads)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Check if any KPI cards are visible
  const hasVisibleKpis = Object.values(settings.kpiCards).some(Boolean)

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
          {/* Salesperson Filter */}
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
          <DashboardCustomizer />
        </div>
      </div>

      {/* Active Filter Badge */}
      {selectedSalesPerson !== 'all' && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            Showing: {selectedSalesPersonName}
          </Badge>
          <button
            onClick={() => setSelectedSalesPerson('all')}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* KPI Cards - responsive grid */}
      {hasVisibleKpis && (
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
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
    </div>
  )
}
