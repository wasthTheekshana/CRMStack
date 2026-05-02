import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Target,
  Trophy,
  BarChart3,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SalesTarget } from '@/types'
import { getAllSalesTargetsByYear } from '@/lib/api/collections'
import { formatCurrency } from '@/config/constants'
import { cn } from '@/lib/utils/cn'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const QUARTERS = [
  { label: 'Q1', months: [1, 2, 3] },
  { label: 'Q2', months: [4, 5, 6] },
  { label: 'Q3', months: [7, 8, 9] },
  { label: 'Q4', months: [10, 11, 12] },
]

const currentYear = new Date().getFullYear()
const YEARS = [currentYear - 1, currentYear, currentYear + 1]

interface QuarterlyData {
  quarter: string
  totalTarget: number
  totalAchievement: number
  variance: number
  percentage: number
  users: {
    name: string
    email: string
    target: number
    achievement: number
    variance: number
    percentage: number
  }[]
}

export function QuarterlyTargets() {
  const [targets, setTargets] = useState<SalesTarget[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(currentYear)

  // Load all targets for the year
  useEffect(() => {
    const loadTargets = async () => {
      setIsLoading(true)
      try {
        const data = await getAllSalesTargetsByYear(selectedYear)
        setTargets(data)
      } catch (error) {
        console.error('Error loading targets:', error)
        toast.error('Failed to load targets')
      } finally {
        setIsLoading(false)
      }
    }

    loadTargets()
  }, [selectedYear])

  // Calculate quarterly data
  const quarterlyData: QuarterlyData[] = useMemo(() => {
    return QUARTERS.map((q) => {
      const quarterTargets = targets.filter((t) => q.months.includes(t.month))

      // Group by user
      const userMap = new Map<string, {
        name: string
        email: string
        target: number
        achievement: number
      }>()

      quarterTargets.forEach((t) => {
        const existing = userMap.get(t.ownerId) || {
          name: t.ownerName,
          email: t.ownerEmail,
          target: 0,
          achievement: 0,
        }
        userMap.set(t.ownerId, {
          ...existing,
          target: existing.target + t.target,
          achievement: existing.achievement + t.achievement,
        })
      })

      const users = Array.from(userMap.values()).map((u) => ({
        ...u,
        variance: u.achievement - u.target,
        percentage: u.target > 0 ? (u.achievement / u.target) * 100 : 0,
      }))

      const totalTarget = users.reduce((sum, u) => sum + u.target, 0)
      const totalAchievement = users.reduce((sum, u) => sum + u.achievement, 0)

      return {
        quarter: q.label,
        totalTarget,
        totalAchievement,
        variance: totalAchievement - totalTarget,
        percentage: totalTarget > 0 ? (totalAchievement / totalTarget) * 100 : 0,
        users,
      }
    })
  }, [targets])

  // Calculate yearly totals
  const yearlyTotals = useMemo(() => {
    const totalTarget = quarterlyData.reduce((sum, q) => sum + q.totalTarget, 0)
    const totalAchievement = quarterlyData.reduce((sum, q) => sum + q.totalAchievement, 0)
    return {
      totalTarget,
      totalAchievement,
      variance: totalAchievement - totalTarget,
      percentage: totalTarget > 0 ? (totalAchievement / totalTarget) * 100 : 0,
    }
  }, [quarterlyData])

  // Chart data
  const chartData = quarterlyData.map((q) => ({
    name: q.quarter,
    Target: q.totalTarget,
    Achievement: q.totalAchievement,
  }))

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
    if (variance < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-400" />
  }

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quarterly Targets Overview</h1>
          <p className="text-sm text-muted-foreground">
            View team performance by quarter
          </p>
        </div>
        <Select
          value={selectedYear.toString()}
          onValueChange={(value) => setSelectedYear(parseInt(value))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Yearly Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Yearly Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(yearlyTotals.totalTarget)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Yearly Achievement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(yearlyTotals.totalAchievement)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {getVarianceIcon(yearlyTotals.variance)}
              Yearly Variance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              'text-2xl font-bold',
              yearlyTotals.variance >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {yearlyTotals.variance >= 0 ? '+' : ''}{formatCurrency(yearlyTotals.variance)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Achievement Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold', getPercentageColor(yearlyTotals.percentage))}>
              {yearlyTotals.percentage.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Quarterly Performance Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#000' }}
                />
                <Legend />
                <Bar dataKey="Target" fill="#94a3b8" name="Target" />
                <Bar dataKey="Achievement" fill="#3b82f6" name="Achievement" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Quarterly Tabs */}
      <Tabs defaultValue="Q1" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {QUARTERS.map((q) => (
            <TabsTrigger key={q.label} value={q.label}>
              {q.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {quarterlyData.map((q) => (
          <TabsContent key={q.quarter} value={q.quarter}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{q.quarter} - {selectedYear}</CardTitle>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      Target: <span className="font-medium text-foreground">{formatCurrency(q.totalTarget)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Achievement: <span className="font-medium text-foreground">{formatCurrency(q.totalAchievement)}</span>
                    </span>
                    <span className={cn('font-medium', getPercentageColor(q.percentage))}>
                      {q.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {q.users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No data for {q.quarter}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sales Rep</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">Achievement</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {q.users.map((user) => (
                        <TableRow key={user.email}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(user.target)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(user.achievement)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              'flex items-center justify-end gap-1',
                              user.variance >= 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                              {getVarianceIcon(user.variance)}
                              {user.variance >= 0 ? '+' : ''}{formatCurrency(user.variance)}
                            </span>
                          </TableCell>
                          <TableCell className={cn('text-right font-medium', getPercentageColor(user.percentage))}>
                            {user.percentage.toFixed(1)}%
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Total Row */}
                      <TableRow className="bg-muted/50 font-medium">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{formatCurrency(q.totalTarget)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(q.totalAchievement)}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            'flex items-center justify-end gap-1',
                            q.variance >= 0 ? 'text-green-600' : 'text-red-600'
                          )}>
                            {getVarianceIcon(q.variance)}
                            {q.variance >= 0 ? '+' : ''}{formatCurrency(q.variance)}
                          </span>
                        </TableCell>
                        <TableCell className={cn('text-right', getPercentageColor(q.percentage))}>
                          {q.percentage.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
