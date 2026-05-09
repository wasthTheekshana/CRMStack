import { useMemo, useState } from 'react'
import { Loader2, Filter, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { PipelineChart } from '@/components/charts/PipelineChart'
import { SolutionPieChart } from '@/components/charts/SolutionPieChart'
import { SolutionLeadsSheet } from '@/components/charts/SolutionLeadsSheet'
import { BubbleChart } from '@/components/charts/BubbleChart'
import { FunnelChart } from '@/components/charts/FunnelChart'
import { useLeads } from '@/hooks/useLeads'
import { useStageData, useSolutionData, useKPIs } from '@/hooks/useKPIs'
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters'
import { useSalesStages, useWonStages } from '@/store/tenantStore'

export function AnalyticsPage() {
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [solutionFilter, setSolutionFilter] = useState<string>('all')
  const [includeClosedWon, setIncludeClosedWon] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedSolution, setSelectedSolution] = useState<string | null>(null)

  const { leads, isLoading } = useLeads()
  const salesStages = useSalesStages()
  const wonStages = useWonStages()

  // Get unique solutions from actual leads data
  const uniqueSolutions = useMemo(() => {
    const solutions = new Set<string>()
    leads.forEach(lead => {
      if (lead.solution) {
        solutions.add(lead.solution)
      }
    })
    return Array.from(solutions).sort()
  }, [leads])

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchesStage = stageFilter === 'all' || lead.salesStage === stageFilter
      const matchesSolution = solutionFilter === 'all' || lead.solution === solutionFilter
      return matchesStage && matchesSolution
    })
  }, [leads, stageFilter, solutionFilter])

  // By default (toggle OFF) closed-won leads are excluded from the solution chart.
  // Toggle ON adds them back. Other charts are unaffected.
  const solutionLeads = useMemo(() => {
    if (includeClosedWon) return filteredLeads
    return filteredLeads.filter(l => !wonStages.includes(l.salesStage))
  }, [filteredLeads, includeClosedWon, wonStages])

  const kpis = useKPIs(filteredLeads)
  const stageData = useStageData(filteredLeads)
  const solutionData = useSolutionData(solutionLeads)

  const sheetLeads = useMemo(() => {
    if (!selectedSolution) return []
    if (/^Others \(\d+\)$/.test(selectedSolution)) {
      const top7 = new Set(solutionData.slice(0, 7).map(d => d.solution))
      return solutionLeads.filter(l => !top7.has(l.solution || 'Other'))
    }
    return solutionLeads.filter(l => (l.solution || 'Other') === selectedSolution)
  }, [selectedSolution, solutionData, solutionLeads])

  const hasActiveFilters = stageFilter !== 'all' || solutionFilter !== 'all' || includeClosedWon

  const clearFilters = () => {
    setStageFilter('all')
    setSolutionFilter('all')
    setIncludeClosedWon(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Detailed analysis of your sales performance
          </p>
        </div>

        {/* Mobile filter button */}
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden relative">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px]">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sales Stage</label>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Stages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {salesStages.map((stage) => (
                      <SelectItem key={stage.name} value={stage.name}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Solution</label>
                <Select value={solutionFilter} onValueChange={setSolutionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Solutions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Solutions</SelectItem>
                    {uniqueSolutions.map((solution) => (
                      <SelectItem key={solution} value={solution}>
                        {solution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-1">
                <Label htmlFor="mobile-closed-won" className="text-sm font-medium cursor-pointer">
                  Include Closed Won (by solution)
                </Label>
                <Switch
                  id="mobile-closed-won"
                  checked={includeClosedWon}
                  onCheckedChange={setIncludeClosedWon}
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Filters */}
      <Card className="hidden md:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {salesStages.map((stage) => (
                  <SelectItem key={stage.name} value={stage.name}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={solutionFilter} onValueChange={setSolutionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by solution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Solutions</SelectItem>
                {uniqueSolutions.map((solution) => (
                  <SelectItem key={solution} value={solution}>
                    {solution}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="desktop-closed-won"
                checked={includeClosedWon}
                onCheckedChange={setIncludeClosedWon}
              />
              <Label htmlFor="desktop-closed-won" className="text-sm cursor-pointer whitespace-nowrap">
                Include Closed Won
              </Label>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats - responsive grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 md:pt-6">
            <p className="text-xs md:text-sm text-muted-foreground">Total Leads</p>
            <p className="text-xl md:text-3xl font-bold">{kpis.totalLeads}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:pt-6">
            <p className="text-xs md:text-sm text-muted-foreground">Pipeline Value</p>
            <p className="text-xl md:text-3xl font-bold">
              {formatCompactNumber(kpis.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:pt-6">
            <p className="text-xs md:text-sm text-muted-foreground">Weighted Value</p>
            <p className="text-xl md:text-3xl font-bold">
              {formatCompactNumber(kpis.weightedRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 md:pt-6">
            <p className="text-xs md:text-sm text-muted-foreground">Avg Probability</p>
            <p className="text-xl md:text-3xl font-bold">{kpis.avgProbability.toFixed(0)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <FunnelChart data={stageData} title="Sales Funnel" />
        <PipelineChart data={stageData} title="Deals by Stage" />
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
        <SolutionPieChart
          data={solutionData}
          title="Revenue by Solution"
          onSliceClick={setSelectedSolution}
          closedWonOnly={includeClosedWon}
          onClosedWonChange={setIncludeClosedWon}
        />
        <PipelineChart
          data={stageData}
          title="Revenue by Stage"
          showRevenue={true}
        />
      </div>

      {/* Opportunity Heatmap */}
      <BubbleChart leads={filteredLeads} title="Opportunity Distribution" />

      {/* Stage Analysis Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Stage Analysis</CardTitle>
        </CardHeader>
        <CardContent className="p-0 md:p-6 md:pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 md:py-3 px-3 md:px-4">Stage</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4">Deals</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4">Revenue</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4 hidden sm:table-cell">Weighted</th>
                  <th className="text-right py-2 md:py-3 px-3 md:px-4">% Pipeline</th>
                </tr>
              </thead>
              <tbody>
                {stageData.map((stage) => {
                  const percentage =
                    kpis.totalRevenue > 0
                      ? (stage.revenue / kpis.totalRevenue) * 100
                      : 0
                  return (
                    <tr key={stage.stage} className="border-b">
                      <td className="py-2 md:py-3 px-3 md:px-4 font-medium">{stage.stage}</td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-right">{stage.count}</td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-right">
                        <span className="hidden sm:inline">{formatCurrency(stage.revenue)}</span>
                        <span className="sm:hidden">{formatCompactNumber(stage.revenue)}</span>
                      </td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-right hidden sm:table-cell">
                        {formatCurrency(stage.weightedRevenue)}
                      </td>
                      <td className="py-2 md:py-3 px-3 md:px-4 text-right">
                        {percentage.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="py-2 md:py-3 px-3 md:px-4">Total</td>
                  <td className="py-2 md:py-3 px-3 md:px-4 text-right">{kpis.totalLeads}</td>
                  <td className="py-2 md:py-3 px-3 md:px-4 text-right">
                    <span className="hidden sm:inline">{formatCurrency(kpis.totalRevenue)}</span>
                    <span className="sm:hidden">{formatCompactNumber(kpis.totalRevenue)}</span>
                  </td>
                  <td className="py-2 md:py-3 px-3 md:px-4 text-right hidden sm:table-cell">
                    {formatCurrency(kpis.weightedRevenue)}
                  </td>
                  <td className="py-2 md:py-3 px-3 md:px-4 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <SolutionLeadsSheet
        open={!!selectedSolution}
        solution={selectedSolution ?? ''}
        leads={sheetLeads}
        onClose={() => setSelectedSolution(null)}
      />
    </div>
  )
}
