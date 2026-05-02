import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StageData } from '@/types'
import { useStageColor } from '@/store/tenantStore'
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters'

interface PipelineChartProps {
  data: StageData[]
  title?: string
  showRevenue?: boolean
}

export function PipelineChart({
  data,
  title = 'Sales Pipeline',
  showRevenue = false,
}: PipelineChartProps) {
  const getStageColor = useStageColor()
  const chartData = data.map((item) => ({
    ...item,
    name:  item.stage,
    color: getStageColor(item.stage),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis
                type="number"
                tickFormatter={(value) =>
                  showRevenue ? formatCompactNumber(value) : value.toString()
                }
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) =>
                  showRevenue ? formatCurrency(value) : value
                }
                labelFormatter={(label) => `Stage: ${label}`}
              />
              <Bar
                dataKey={showRevenue ? 'revenue' : 'count'}
                radius={[0, 4, 4, 0]}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
