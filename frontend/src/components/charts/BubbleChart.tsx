import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Lead } from '@/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { useStageColor } from '@/store/tenantStore'

interface BubbleChartProps {
  leads: Lead[]
  title?: string
}

export function BubbleChart({
  leads,
  title = 'Opportunity Heatmap',
}: BubbleChartProps) {
  const getStageColor = useStageColor()
  const chartData = leads.map((lead) => ({
    x: lead.probability,
    y: lead.estimatedRevenue,
    z: lead.estimatedRevenue,
    name: lead.companyName,
    stage: lead.salesStage,
    color: getStageColor(lead.salesStage),
  }))

  const maxRevenue = Math.max(...leads.map((l) => l.estimatedRevenue), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="Probability"
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                label={{
                  value: 'Probability (%)',
                  position: 'bottom',
                  offset: 0,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Revenue"
                tickFormatter={(value) =>
                  value >= 1000000
                    ? `${(value / 1000000).toFixed(1)}M`
                    : value >= 1000
                    ? `${(value / 1000).toFixed(0)}K`
                    : value.toString()
                }
                label={{
                  value: 'Revenue',
                  angle: -90,
                  position: 'insideLeft',
                }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                range={[50, 400]}
                domain={[0, maxRevenue]}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-white p-3 border rounded-lg shadow-lg">
                        <p className="font-semibold">{data.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Stage: {data.stage}
                        </p>
                        <p className="text-sm">
                          Revenue: {formatCurrency(data.y)}
                        </p>
                        <p className="text-sm">Probability: {data.x}%</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Scatter name="Opportunities" data={chartData}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
