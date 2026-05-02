import {
  FunnelChart as RechartsFunnel,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StageData } from '@/types'
import { useSalesStages } from '@/store/tenantStore'

interface FunnelChartProps {
  data: StageData[]
  title?: string
}

export function FunnelChart({
  data,
  title = 'Sales Funnel',
}: FunnelChartProps) {
  const salesStages = useSalesStages()
  const chartData = salesStages
    .map((stage) => {
      const stageData = data.find((d) => d.stage === stage.name)
      return {
        name:  stage.name,
        value: stageData?.count || 0,
        fill:  stage.color,
      }
    })
    .filter((d) => d.value > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsFunnel
              margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
            >
              <Tooltip
                formatter={(value: number, name: string) => [
                  `${value} deals`,
                  name,
                ]}
              />
              <Funnel
                data={chartData}
                dataKey="value"
                nameKey="name"
                isAnimationActive
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList
                  position="right"
                  fill="#000"
                  stroke="none"
                  dataKey="name"
                  fontSize={12}
                />
                <LabelList
                  position="center"
                  fill="#fff"
                  stroke="none"
                  dataKey="value"
                  fontSize={14}
                  fontWeight="bold"
                />
              </Funnel>
            </RechartsFunnel>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
