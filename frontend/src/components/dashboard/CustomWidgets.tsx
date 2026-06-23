import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { apiFetch } from '@/config/api'
import { formatCompactNumber } from '@/lib/utils/formatters'

interface WidgetData {
  id: string
  name: string
  chart_type: 'number' | 'bar' | 'pie' | 'table'
  data: { value: number } | { group: string; total: number; average: number; count: number }[]
}

const COLORS = ['#3B82F6', '#22C55E', '#F97316', '#8B5CF6', '#EC4899', '#EAB308', '#06B6D4', '#F43F5E']

export function CustomWidgets() {
  const [widgets, setWidgets] = useState<WidgetData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const result = await apiFetch<{ widgets: WidgetData[] }>('/api/kpis/custom-widgets')
        setWidgets(result.widgets)
      } catch (err) {
        console.error('Failed to load custom widgets:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchWidgets()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (widgets.length === 0) return null

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Custom Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgets.map(widget => (
          <Card key={widget.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{widget.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {widget.chart_type === 'number' && !Array.isArray(widget.data) && (
                <div className="text-3xl font-bold">
                  {formatCompactNumber((widget.data as { value: number }).value)}
                </div>
              )}

              {widget.chart_type === 'bar' && Array.isArray(widget.data) && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={widget.data}>
                    <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}

              {widget.chart_type === 'pie' && Array.isArray(widget.data) && (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={widget.data}
                      dataKey="total"
                      nameKey="group"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ group }) => group}
                    >
                      {widget.data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}

              {widget.chart_type === 'table' && Array.isArray(widget.data) && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1">Group</th>
                      <th className="py-1 text-right">Count</th>
                      <th className="py-1 text-right">Total</th>
                      <th className="py-1 text-right">Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {widget.data.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1">{row.group}</td>
                        <td className="py-1 text-right">{row.count}</td>
                        <td className="py-1 text-right">{formatCompactNumber(row.total)}</td>
                        <td className="py-1 text-right">{formatCompactNumber(row.average)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
