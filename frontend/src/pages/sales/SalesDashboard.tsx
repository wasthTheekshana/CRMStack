import {
  Building2,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Loader2,
} from 'lucide-react'
import { KPICard } from '@/components/dashboard/KPICard'
import { TopCustomers } from '@/components/dashboard/TopCustomers'
import { RecentActivities } from '@/components/dashboard/RecentActivities'
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks'
import { PipelineChart } from '@/components/charts/PipelineChart'
import { SolutionPieChart } from '@/components/charts/SolutionPieChart'
import { BubbleChart } from '@/components/charts/BubbleChart'
import { useLeads } from '@/hooks/useLeads'
import { useKPIs, useStageData, useSolutionData, useTopCustomers } from '@/hooks/useKPIs'
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters'
import { useAuthStore } from '@/store/authStore'

export function SalesDashboard() {
  const { userProfile } = useAuthStore()
  const { leads, isLoading } = useLeads()
  const kpis = useKPIs(leads)
  const stageData = useStageData(leads)
  const solutionData = useSolutionData(leads)
  const topCustomers = useTopCustomers(leads)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">
          Welcome, {userProfile?.displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's an overview of your sales performance
        </p>
      </div>

      {/* KPI Cards - responsive grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <KPICard
          title="My Companies"
          value={kpis.totalCompanies}
          icon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
          colorScheme="blue"
        />
        <KPICard
          title="My Leads"
          value={kpis.totalLeads}
          icon={<Users className="h-5 w-5 md:h-6 md:w-6" />}
          colorScheme="green"
        />
        <KPICard
          title="Active Deals"
          value={kpis.activeDeals}
          icon={<Target className="h-5 w-5 md:h-6 md:w-6" />}
          colorScheme="purple"
        />
        <KPICard
          title="My Pipeline"
          value={formatCompactNumber(kpis.totalRevenue)}
          subtitle={formatCurrency(kpis.totalRevenue)}
          icon={<DollarSign className="h-5 w-5 md:h-6 md:w-6" />}
          colorScheme="orange"
        />
        <KPICard
          title="Weighted"
          value={formatCompactNumber(kpis.weightedRevenue)}
          subtitle={`${kpis.avgProbability.toFixed(0)}% avg`}
          icon={<TrendingUp className="h-5 w-5 md:h-6 md:w-6" />}
          colorScheme="green"
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Quick access: upcoming/pending tasks */}
      <UpcomingTasks />

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <PipelineChart data={stageData} title="My Pipeline by Stage" />
        <SolutionPieChart data={solutionData} title="My Revenue by Solution" />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BubbleChart leads={leads} title="My Opportunities" />
        </div>
        <TopCustomers customers={topCustomers} />
      </div>

      {/* Activities */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <RecentActivities />
        <PipelineChart
          data={stageData}
          title="Revenue by Stage"
          showRevenue={true}
        />
      </div>
    </div>
  )
}
