import { useMemo } from 'react'
import {
  TrendingUp,
  Target,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lead } from '@/types'
import { useSalesStages, useWonStages } from '@/store/tenantStore'
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters'

interface RevenueForecastProps {
  leads: Lead[]
  title?: string
}

export function RevenueForecast({ leads, title = 'Revenue Forecasting' }: RevenueForecastProps) {
  const salesStages = useSalesStages()
  const wonStages = useWonStages()
  const forecast = useMemo(() => {
    // Get current date info
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentQuarter = Math.ceil(currentMonth / 3)

    // Filter active deals (not closed)
    const activeDeals = leads.filter(l => !wonStages.includes(l.salesStage))
    const closedDeals = leads.filter(l => wonStages.includes(l.salesStage))

    // Calculate forecasts
    const totalPipeline = activeDeals.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)

    // Weighted forecast (based on probability)
    const weightedForecast = activeDeals.reduce(
      (sum, l) => sum + ((l.estimatedRevenue || 0) * (l.probability || 0)) / 100,
      0
    )

    // Best case: All active deals close (100% probability)
    const bestCase = totalPipeline

    // Worst case: Only deals with >75% probability close at their weighted value
    const worstCase = activeDeals
      .filter(l => l.probability >= 75)
      .reduce((sum, l) => sum + ((l.estimatedRevenue || 0) * (l.probability || 0)) / 100, 0)

    // Expected this month (deals likely to close - high probability)
    const expectedThisMonth = activeDeals
      .filter(l => l.probability >= 50)
      .reduce((sum, l) => sum + ((l.estimatedRevenue || 0) * (l.probability || 0)) / 100, 0)

    // Expected this quarter (all weighted)
    const expectedThisQuarter = weightedForecast

    // Already closed revenue
    const closedRevenue = closedDeals.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)

    // By stage breakdown
    const byStage = salesStages.map(stage => {
      const stageDeals = leads.filter(l => l.salesStage === stage.name)
      const revenue = stageDeals.reduce((sum, l) => sum + (l.estimatedRevenue || 0), 0)
      const weightedRevenue = stageDeals.reduce(
        (sum, l) => sum + ((l.estimatedRevenue || 0) * (l.probability || 0)) / 100,
        0
      )
      return {
        stage: stage.name,
        label: stage.name,
        color: stage.color,
        deals: stageDeals.length,
        revenue,
        weightedRevenue,
        probability: stage.probability,
      }
    })

    return {
      currentMonth,
      currentQuarter,
      totalPipeline,
      weightedForecast,
      bestCase,
      worstCase,
      expectedThisMonth,
      expectedThisQuarter,
      closedRevenue,
      activeDeals: activeDeals.length,
      byStage,
    }
  }, [leads, salesStages, wonStages])

  // Chart data for stage breakdown
  const chartData = forecast.byStage.map(s => ({
    name: s.label.split(' ')[0], // Shortened name
    fullName: s.label,
    pipeline: s.revenue,
    weighted: s.weightedRevenue,
    deals: s.deals,
    color: s.color,
  }))

  const quarterNames = ['Q1', 'Q2', 'Q3', 'Q4']

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Expected This Month */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium">This Month</span>
            </div>
            <p className="text-lg font-bold text-blue-700">
              {formatCompactNumber(forecast.expectedThisMonth)}
            </p>
            <p className="text-xs text-blue-600">Expected revenue</p>
          </div>

          {/* Expected This Quarter */}
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Target className="h-4 w-4" />
              <span className="text-xs font-medium">{quarterNames[forecast.currentQuarter - 1]}</span>
            </div>
            <p className="text-lg font-bold text-purple-700">
              {formatCompactNumber(forecast.expectedThisQuarter)}
            </p>
            <p className="text-xs text-purple-600">Weighted forecast</p>
          </div>

          {/* Best Case */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-100">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <ArrowUpRight className="h-4 w-4" />
              <span className="text-xs font-medium">Best Case</span>
            </div>
            <p className="text-lg font-bold text-green-700">
              {formatCompactNumber(forecast.bestCase)}
            </p>
            <p className="text-xs text-green-600">If all deals close</p>
          </div>

          {/* Worst Case */}
          <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <ArrowDownRight className="h-4 w-4" />
              <span className="text-xs font-medium">Worst Case</span>
            </div>
            <p className="text-lg font-bold text-orange-700">
              {formatCompactNumber(forecast.worstCase)}
            </p>
            <p className="text-xs text-orange-600">High prob. only</p>
          </div>
        </div>

        {/* Pipeline Stats */}
        <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Pipeline:</span>
            <span className="font-semibold">{formatCurrency(forecast.totalPipeline)}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            <span className="text-sm text-muted-foreground">Closed Won:</span>
            <span className="font-semibold text-green-600">{formatCurrency(forecast.closedRevenue)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-muted-foreground">Active Deals:</span>
            <span className="font-semibold">{forecast.activeDeals}</span>
          </div>
        </div>

        {/* Stage Breakdown Chart */}
        <div>
          <h4 className="text-sm font-medium mb-3">Forecast by Stage</h4>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatCompactNumber(v)}
                  fontSize={11}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={70}
                  fontSize={11}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'pipeline' ? 'Pipeline' : 'Weighted'
                  ]}
                  labelFormatter={(_label, payload) => {
                    const data = payload?.[0]?.payload
                    return `${data?.fullName} (${data?.deals} deals)`
                  }}
                />
                <Legend />
                <Bar
                  dataKey="pipeline"
                  name="Pipeline"
                  radius={[0, 4, 4, 0]}
                  fill="#94A3B8"
                />
                <Bar
                  dataKey="weighted"
                  name="Weighted"
                  radius={[0, 4, 4, 0]}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stage Details Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2 px-2">Stage</th>
                <th className="text-center py-2 px-2">Deals</th>
                <th className="text-right py-2 px-2">Pipeline</th>
                <th className="text-right py-2 px-2">Weighted</th>
                <th className="text-center py-2 px-2">Prob.</th>
              </tr>
            </thead>
            <tbody>
              {forecast.byStage.map((stage) => (
                <tr key={stage.stage} className="border-b hover:bg-muted/20">
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-medium">{stage.label}</span>
                    </div>
                  </td>
                  <td className="text-center py-2 px-2">
                    <Badge variant="secondary" className="text-xs">
                      {stage.deals}
                    </Badge>
                  </td>
                  <td className="text-right py-2 px-2">
                    {formatCompactNumber(stage.revenue)}
                  </td>
                  <td className="text-right py-2 px-2 font-semibold" style={{ color: stage.color }}>
                    {formatCompactNumber(stage.weightedRevenue)}
                  </td>
                  <td className="text-center py-2 px-2">
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ borderColor: stage.color, color: stage.color }}
                    >
                      {stage.probability}%
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/50 font-semibold">
                <td className="py-2 px-2">Total</td>
                <td className="text-center py-2 px-2">{leads.length}</td>
                <td className="text-right py-2 px-2">
                  {formatCompactNumber(forecast.totalPipeline + forecast.closedRevenue)}
                </td>
                <td className="text-right py-2 px-2 text-green-600">
                  {formatCompactNumber(forecast.weightedForecast + forecast.closedRevenue)}
                </td>
                <td className="text-center py-2 px-2">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
