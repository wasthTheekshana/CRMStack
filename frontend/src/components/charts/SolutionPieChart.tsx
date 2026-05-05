import { useState } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SolutionData } from '@/types'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/formatters'
import { CHART_COLORS } from '@/config/constants'

interface SolutionPieChartProps {
  data: SolutionData[]
  title?: string
  onSliceClick?: (solution: string) => void
}

// Group smaller solutions into "Others" category
function processChartData(data: SolutionData[], topCount: number = 6) {
  // Sort by revenue descending
  const sorted = [...data].sort((a, b) => b.revenue - a.revenue)

  // If we have fewer items than topCount, return all
  if (sorted.length <= topCount) {
    return sorted.map((item, index) => ({
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }))
  }

  // Take top items and group rest into "Others"
  const topItems = sorted.slice(0, topCount - 1)
  const otherItems = sorted.slice(topCount - 1)
  const othersRevenue = otherItems.reduce((sum, item) => sum + item.revenue, 0)
  const othersCount = otherItems.reduce((sum, item) => sum + item.count, 0)

  const result = [
    ...topItems.map((item, index) => ({
      ...item,
      color: CHART_COLORS[index % CHART_COLORS.length],
    })),
    {
      solution: `Others (${otherItems.length})`,
      revenue: othersRevenue,
      count: othersCount,
      color: '#9CA3AF', // gray
    },
  ]

  return result
}

export function SolutionPieChart({
  data,
  title = 'Revenue by Solution',
  onSliceClick,
}: SolutionPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const chartData = processChartData(data, 8)
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)

  const onPieEnter = (_: unknown, index: number) => {
    setActiveIndex(index)
  }

  const onPieLeave = () => {
    setActiveIndex(null)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Chart */}
          <div className="h-[220px] lg:h-[280px] flex-1 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={activeIndex !== null ? 90 : 85}
                  paddingAngle={1}
                  dataKey="revenue"
                  nameKey="solution"
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                      style={{
                        transition: 'opacity 0.2s ease-in-out',
                        cursor: onSliceClick ? 'pointer' : 'default'
                      }}
                      onClick={() => onSliceClick?.(entry.solution)}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      const percent = ((data.revenue / totalRevenue) * 100).toFixed(1)
                      return (
                        <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-semibold text-gray-900">{data.solution}</p>
                          <p className="text-gray-600">Revenue: {formatCurrency(data.revenue)}</p>
                          <p className="text-gray-600">Deals: {data.count}</p>
                          <p className="text-gray-600">Share: {percent}%</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Custom Legend */}
          <div className="lg:w-[180px] flex-shrink-0">
            <div className="max-h-[280px] overflow-y-auto pr-1 space-y-1.5">
              {chartData.map((entry, index) => {
                const percent = ((entry.revenue / totalRevenue) * 100).toFixed(1)
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-2 p-1.5 rounded transition-colors ${
                      onSliceClick ? 'cursor-pointer' : 'cursor-default'
                    } ${activeIndex === index ? 'bg-gray-100' : onSliceClick ? 'hover:bg-gray-50' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={() => onSliceClick?.(entry.solution)}
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-900 truncate" title={entry.solution}>
                        {entry.solution}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCompactCurrency(entry.revenue)} ({percent}%)
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
