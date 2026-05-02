import React, { useState, useEffect, useMemo } from 'react'
import { Loader2, Trophy, Users, DollarSign, TrendingUp, Award, Target, Percent, Building2 } from 'lucide-react'
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getSalesUsers, getLeads } from '@/lib/api/collections'
import { Lead, User } from '@/types'
import { formatCurrency, formatCompactNumber } from '@/lib/utils/formatters'
import { cn } from '@/lib/utils/cn'
import { useSalesStages, useWonStages } from '@/store/tenantStore'

const REP_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6']

const PROBABILITY_BUCKETS = [
  { id: 10, label: '≤10%', min: 0, max: 10, color: '#F97316' },
  { id: 25, label: '11-25%', min: 11, max: 25, color: '#EF4444' },
  { id: 50, label: '26-50%', min: 26, max: 50, color: '#F59E0B' },
  { id: 75, label: '51-75%', min: 51, max: 75, color: '#3B82F6' },
  { id: 90, label: '76-90%', min: 76, max: 90, color: '#8B5CF6' },
  { id: 100, label: '91-100%', min: 91, max: 100, color: '#10B981' },
]

interface RepMetrics {
  uid: string
  name: string
  email: string
  totalAccounts: number
  totalRevenue: number
  weightedRevenue: number
  avgProbability: number
  avgDealSize: number
  closedWon: number
  activeDeals: number
  winRate: number
  leads: Lead[]
  stageBreakdown: { stage: string; count: number; revenue: number }[]
  probabilityBreakdown: { bucket: number; label: string; count: number; revenue: number; weightedRevenue: number }[]
  color: string
}

export function RepComparison() {
  const [isLoading, setIsLoading] = useState(true)
  const [salesUsers, setSalesUsers] = useState<User[]>([])
  const [leadsData, setLeadsData] = useState<Record<string, Lead[]>>({})
  const salesStages = useSalesStages()
  const wonStages = useWonStages()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const users = await getSalesUsers()
        setSalesUsers(users)

        // Fetch all leads once, then partition by owner client-side
        const allLeads = await getLeads()
        const leadsMap: Record<string, Lead[]> = {}
        for (const user of users) {
          leadsMap[user.uid] = allLeads.filter(l => l.ownerId === user.uid)
        }
        setLeadsData(leadsMap)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate comprehensive metrics for each rep
  const repMetrics: RepMetrics[] = useMemo(() => {
    return salesUsers.map((user, index) => {
      const leads = leadsData[user.uid] || []
      const closedWon = leads.filter((l) => wonStages.includes(l.salesStage)).length
      const activeDeals = leads.filter(
        (l) => !wonStages.includes(l.salesStage)
      ).length
      const totalRevenue = leads.reduce((sum, l) => sum + l.estimatedRevenue, 0)

      // Stage breakdown
      const stageBreakdown = salesStages.map((stage) => {
        const stageLeads = leads.filter((l) => l.salesStage === stage.name)
        return {
          stage: stage.name,
          count: stageLeads.length,
          revenue: stageLeads.reduce((sum, l) => sum + l.estimatedRevenue, 0),
        }
      })

      // Probability breakdown
      const probabilityBreakdown = PROBABILITY_BUCKETS.map((bucket) => {
        const bucketLeads = leads.filter(
          (l) => l.probability >= bucket.min && l.probability <= bucket.max
        )
        return {
          bucket: bucket.id,
          label: bucket.label,
          count: bucketLeads.length,
          revenue: bucketLeads.reduce((sum, l) => sum + l.estimatedRevenue, 0),
          weightedRevenue: bucketLeads.reduce(
            (sum, l) => sum + (l.estimatedRevenue * l.probability) / 100,
            0
          ),
        }
      })

      return {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        totalAccounts: leads.length,
        totalRevenue,
        weightedRevenue: leads.reduce(
          (sum, l) => sum + (l.estimatedRevenue * l.probability) / 100,
          0
        ),
        avgProbability:
          leads.length > 0
            ? leads.reduce((sum, l) => sum + l.probability, 0) / leads.length
            : 0,
        avgDealSize: leads.length > 0 ? totalRevenue / leads.length : 0,
        closedWon,
        activeDeals,
        winRate:
          leads.length > 0
            ? (closedWon / leads.length) * 100
            : 0,
        leads,
        stageBreakdown,
        probabilityBreakdown,
        color: REP_COLORS[index % REP_COLORS.length],
      }
    })
  }, [salesUsers, leadsData, salesStages, wonStages])

  // Calculate company totals
  const companyTotals = useMemo(() => {
    return {
      totalAccounts: repMetrics.reduce((sum, rep) => sum + rep.totalAccounts, 0),
      totalRevenue: repMetrics.reduce((sum, rep) => sum + rep.totalRevenue, 0),
      weightedRevenue: repMetrics.reduce((sum, rep) => sum + rep.weightedRevenue, 0),
      closedWon: repMetrics.reduce((sum, rep) => sum + rep.closedWon, 0),
      activeDeals: repMetrics.reduce((sum, rep) => sum + rep.activeDeals, 0),
    }
  }, [repMetrics])

  // Probability comparison chart data
  const probabilityComparisonData = useMemo(() => {
    return PROBABILITY_BUCKETS.map((bucket) => {
      const data: Record<string, number | string> = { probability: bucket.label }
      repMetrics.forEach((rep) => {
        const probData = rep.probabilityBreakdown.find((p) => p.bucket === bucket.id)
        data[rep.name] = probData?.count || 0
      })
      return data
    })
  }, [repMetrics])

  // Probability revenue comparison data
  const probabilityRevenueData = useMemo(() => {
    return PROBABILITY_BUCKETS.map((bucket) => {
      const data: Record<string, number | string> = { probability: bucket.label }
      repMetrics.forEach((rep) => {
        const probData = rep.probabilityBreakdown.find((p) => p.bucket === bucket.id)
        data[rep.name] = probData?.revenue || 0
      })
      return data
    })
  }, [repMetrics])

  // Rankings
  const rankings = useMemo(() => {
    const byAccounts = [...repMetrics].sort((a, b) => b.totalAccounts - a.totalAccounts)
    const byVolume = [...repMetrics].sort((a, b) => b.totalRevenue - a.totalRevenue)
    const byWeighted = [...repMetrics].sort((a, b) => b.weightedRevenue - a.weightedRevenue)
    const byWinRate = [...repMetrics].sort((a, b) => b.winRate - a.winRate)
    const byAvgDeal = [...repMetrics].sort((a, b) => b.avgDealSize - a.avgDealSize)

    return { byAccounts, byVolume, byWeighted, byWinRate, byAvgDeal }
  }, [repMetrics])

  // Chart data for account comparison
  const accountComparisonData = repMetrics.map((rep) => ({
    name: rep.name,
    accounts: rep.totalAccounts,
    activeDeals: rep.activeDeals,
    closedWon: rep.closedWon,
    fill: rep.color,
  }))

  // Chart data for volume comparison
  const volumeComparisonData = repMetrics.map((rep) => ({
    name: rep.name,
    pipeline: rep.totalRevenue,
    weighted: rep.weightedRevenue,
    fill: rep.color,
  }))

  // Radar chart data for overall comparison
  const radarData = useMemo(() => {
    const maxAccounts = Math.max(...repMetrics.map((r) => r.totalAccounts), 1)
    const maxRevenue = Math.max(...repMetrics.map((r) => r.totalRevenue), 1)
    const maxWeighted = Math.max(...repMetrics.map((r) => r.weightedRevenue), 1)
    const maxAvgDeal = Math.max(...repMetrics.map((r) => r.avgDealSize), 1)

    return [
      {
        metric: 'Accounts',
        ...repMetrics.reduce(
          (acc, rep) => ({
            ...acc,
            [rep.name]: (rep.totalAccounts / maxAccounts) * 100,
          }),
          {}
        ),
      },
      {
        metric: 'Pipeline',
        ...repMetrics.reduce(
          (acc, rep) => ({
            ...acc,
            [rep.name]: (rep.totalRevenue / maxRevenue) * 100,
          }),
          {}
        ),
      },
      {
        metric: 'Weighted',
        ...repMetrics.reduce(
          (acc, rep) => ({
            ...acc,
            [rep.name]: (rep.weightedRevenue / maxWeighted) * 100,
          }),
          {}
        ),
      },
      {
        metric: 'Avg Deal',
        ...repMetrics.reduce(
          (acc, rep) => ({
            ...acc,
            [rep.name]: (rep.avgDealSize / maxAvgDeal) * 100,
          }),
          {}
        ),
      },
      {
        metric: 'Win Rate',
        ...repMetrics.reduce(
          (acc, rep) => ({
            ...acc,
            [rep.name]: rep.winRate,
          }),
          {}
        ),
      },
      {
        metric: 'Avg Prob',
        ...repMetrics.reduce(
          (acc, rep) => ({
            ...acc,
            [rep.name]: rep.avgProbability,
          }),
          {}
        ),
      },
    ]
  }, [repMetrics])

  // Stage comparison data
  const stageComparisonData = useMemo(() => {
    return salesStages.map((stage) => {
      const data: Record<string, number | string> = { stage: stage.name }
      repMetrics.forEach((rep) => {
        const stageData = rep.stageBreakdown.find((s) => s.stage === stage.name)
        data[rep.name] = stageData?.count || 0
      })
      return data
    })
  }, [repMetrics, salesStages])

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
        <h1 className="text-xl md:text-2xl font-bold">Sales Performance</h1>
        <p className="text-sm text-muted-foreground">
          Compare performance between sales representatives
        </p>
      </div>

      {/* Company Total Summary Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Accounts</p>
              <p className="font-bold text-2xl text-primary">{companyTotals.totalAccounts}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pipeline</p>
              <p className="font-bold text-2xl text-primary">{formatCompactNumber(companyTotals.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(companyTotals.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Weighted Revenue</p>
              <p className="font-bold text-2xl text-primary">{formatCompactNumber(companyTotals.weightedRevenue)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(companyTotals.weightedRevenue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Closed Won</p>
              <p className="font-bold text-2xl text-green-600">{companyTotals.closedWon}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Deals</p>
              <p className="font-bold text-2xl text-blue-600">{companyTotals.activeDeals}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary Cards */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {repMetrics.map((rep, index) => {
          const revenueContribution = companyTotals.totalRevenue > 0
            ? (rep.totalRevenue / companyTotals.totalRevenue) * 100
            : 0
          const accountContribution = companyTotals.totalAccounts > 0
            ? (rep.totalAccounts / companyTotals.totalAccounts) * 100
            : 0

          return (
            <Card key={rep.uid} className="relative overflow-hidden">
              <div
                className="absolute top-0 left-0 w-1 h-full"
                style={{ backgroundColor: rep.color }}
              />
              <CardHeader className="pb-2">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: rep.color }}
                  />
                  <span className="truncate">{rep.name}</span>
                  {index === 0 && rankings.byVolume[0]?.uid === rep.uid && (
                    <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {revenueContribution.toFixed(1)}% of company revenue
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Accounts</p>
                    <p className="font-bold text-lg">{rep.totalAccounts}</p>
                    <p className="text-xs text-muted-foreground">{accountContribution.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pipeline</p>
                    <p className="font-bold text-lg">{formatCompactNumber(rep.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">{revenueContribution.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Weighted</p>
                    <p className="font-semibold">{formatCompactNumber(rep.weightedRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Deal</p>
                    <p className="font-semibold">{formatCompactNumber(rep.avgDealSize)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    Won: {rep.closedWon}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Active: {rep.activeDeals}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="comparison" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="comparison" className="text-xs md:text-sm">Comparison</TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-xs md:text-sm">Leaderboard</TabsTrigger>
          <TabsTrigger value="probability" className="text-xs md:text-sm">Probability</TabsTrigger>
          <TabsTrigger value="stages" className="text-xs md:text-sm">By Stage</TabsTrigger>
        </TabsList>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4 md:space-y-6">
          {/* Account vs Volume Comparison */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Account Count Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Account Count Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accountComparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="accounts" name="Total Accounts" radius={[0, 4, 4, 0]}>
                        {accountComparisonData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Volume Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Volume Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeComparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => formatCompactNumber(v)}
                      />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      <Bar
                        dataKey="pipeline"
                        name="Pipeline"
                        fill="#3B82F6"
                        radius={[0, 4, 4, 0]}
                      />
                      <Bar
                        dataKey="weighted"
                        name="Weighted"
                        fill="#10B981"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overall Performance Radar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                Overall Performance Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {repMetrics.map((rep) => (
                      <Radar
                        key={rep.uid}
                        name={rep.name}
                        dataKey={rep.name}
                        stroke={rep.color}
                        fill={rep.color}
                        fillOpacity={0.2}
                      />
                    ))}
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* By Accounts */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  By Account Count
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.byAccounts.map((rep, index) => (
                  <div
                    key={rep.uid}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg',
                      index === 0 && 'bg-yellow-50 border border-yellow-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          index === 0
                            ? 'bg-yellow-500 text-white'
                            : index === 1
                            ? 'bg-gray-400 text-white'
                            : index === 2
                            ? 'bg-orange-400 text-white'
                            : 'bg-gray-200 text-gray-600'
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium text-sm">{rep.name}</span>
                    </div>
                    <span className="font-bold">{rep.totalAccounts}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* By Volume */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  By Pipeline Volume
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.byVolume.map((rep, index) => (
                  <div
                    key={rep.uid}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg',
                      index === 0 && 'bg-yellow-50 border border-yellow-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          index === 0
                            ? 'bg-yellow-500 text-white'
                            : index === 1
                            ? 'bg-gray-400 text-white'
                            : index === 2
                            ? 'bg-orange-400 text-white'
                            : 'bg-gray-200 text-gray-600'
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium text-sm">{rep.name}</span>
                    </div>
                    <span className="font-bold">{formatCompactNumber(rep.totalRevenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* By Weighted Revenue */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  By Weighted Value
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.byWeighted.map((rep, index) => (
                  <div
                    key={rep.uid}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg',
                      index === 0 && 'bg-yellow-50 border border-yellow-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          index === 0
                            ? 'bg-yellow-500 text-white'
                            : index === 1
                            ? 'bg-gray-400 text-white'
                            : index === 2
                            ? 'bg-orange-400 text-white'
                            : 'bg-gray-200 text-gray-600'
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium text-sm">{rep.name}</span>
                    </div>
                    <span className="font-bold">{formatCompactNumber(rep.weightedRevenue)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* By Avg Deal Size */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-5 w-5 text-orange-500" />
                  By Avg Deal Size
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.byAvgDeal.map((rep, index) => (
                  <div
                    key={rep.uid}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg',
                      index === 0 && 'bg-yellow-50 border border-yellow-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          index === 0
                            ? 'bg-yellow-500 text-white'
                            : index === 1
                            ? 'bg-gray-400 text-white'
                            : index === 2
                            ? 'bg-orange-400 text-white'
                            : 'bg-gray-200 text-gray-600'
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium text-sm">{rep.name}</span>
                    </div>
                    <span className="font-bold">{formatCompactNumber(rep.avgDealSize)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* By Win Rate */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-5 w-5 text-cyan-500" />
                  By Win Rate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rankings.byWinRate.map((rep, index) => (
                  <div
                    key={rep.uid}
                    className={cn(
                      'flex items-center justify-between p-2 rounded-lg',
                      index === 0 && 'bg-yellow-50 border border-yellow-200'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          index === 0
                            ? 'bg-yellow-500 text-white'
                            : index === 1
                            ? 'bg-gray-400 text-white'
                            : index === 2
                            ? 'bg-orange-400 text-white'
                            : 'bg-gray-200 text-gray-600'
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="font-medium text-sm">{rep.name}</span>
                    </div>
                    <span className="font-bold">{rep.winRate.toFixed(1)}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Probability Tab */}
        <TabsContent value="probability" className="space-y-4">
          {/* Probability comparison charts */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Deals by Probability */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <Percent className="h-5 w-5 text-purple-500" />
                  Deals by Probability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] md:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={probabilityComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="probability" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      {repMetrics.map((rep) => (
                        <Bar
                          key={rep.uid}
                          dataKey={rep.name}
                          fill={rep.color}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Probability */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  Revenue by Probability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] md:h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={probabilityRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="probability" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => formatCompactNumber(v)} />
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                      <Legend />
                      {repMetrics.map((rep) => (
                        <Bar
                          key={rep.uid}
                          dataKey={rep.name}
                          fill={rep.color}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Probability Summary Cards */}
          <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-6">
            {PROBABILITY_BUCKETS.map((bucket) => {
              const totalDeals = repMetrics.reduce((sum, rep) => {
                const probData = rep.probabilityBreakdown.find((p) => p.bucket === bucket.id)
                return sum + (probData?.count || 0)
              }, 0)
              const totalRevenue = repMetrics.reduce((sum, rep) => {
                const probData = rep.probabilityBreakdown.find((p) => p.bucket === bucket.id)
                return sum + (probData?.revenue || 0)
              }, 0)
              return (
                <Card key={bucket.id}>
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: bucket.color }}
                      />
                      <span className="font-semibold text-sm">{bucket.label}</span>
                    </div>
                    <p className="text-2xl font-bold">{totalDeals}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCompactNumber(totalRevenue)}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Probability breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Probability Breakdown Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 md:py-3 px-3 md:px-4">Probability</th>
                      {repMetrics.map((rep) => (
                        <th
                          key={rep.uid}
                          className="text-center py-2 md:py-3 px-2 md:px-4"
                          colSpan={3}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: rep.color }}
                            />
                            <span>{rep.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-1 px-3 md:px-4"></th>
                      {repMetrics.map((rep) => (
                        <React.Fragment key={`${rep.uid}-headers`}>
                          <th className="text-right py-1 px-2 text-xs">Deals</th>
                          <th className="text-right py-1 px-2 text-xs">Revenue</th>
                          <th className="text-right py-1 px-2 text-xs hidden md:table-cell">Weighted</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PROBABILITY_BUCKETS.map((bucket) => (
                      <tr key={bucket.id} className="border-b hover:bg-muted/20">
                        <td className="py-2 md:py-3 px-3 md:px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: bucket.color }}
                            />
                            <span className="font-medium">{bucket.label}</span>
                          </div>
                        </td>
                        {repMetrics.map((rep) => {
                          const probData = rep.probabilityBreakdown.find(
                            (p) => p.bucket === bucket.id
                          )
                          return (
                            <React.Fragment key={`${rep.uid}-${bucket.id}`}>
                              <td className="text-right py-2 md:py-3 px-2">
                                {probData?.count || 0}
                              </td>
                              <td className="text-right py-2 md:py-3 px-2">
                                <span className="hidden sm:inline">
                                  {formatCurrency(probData?.revenue || 0)}
                                </span>
                                <span className="sm:hidden">
                                  {formatCompactNumber(probData?.revenue || 0)}
                                </span>
                              </td>
                              <td className="text-right py-2 md:py-3 px-2 hidden md:table-cell">
                                {formatCurrency(probData?.weightedRevenue || 0)}
                              </td>
                            </React.Fragment>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold">
                      <td className="py-2 md:py-3 px-3 md:px-4">Total</td>
                      {repMetrics.map((rep) => (
                        <React.Fragment key={`${rep.uid}-total`}>
                          <td className="text-right py-2 md:py-3 px-2">
                            {rep.totalAccounts}
                          </td>
                          <td className="text-right py-2 md:py-3 px-2">
                            <span className="hidden sm:inline">
                              {formatCurrency(rep.totalRevenue)}
                            </span>
                            <span className="sm:hidden">
                              {formatCompactNumber(rep.totalRevenue)}
                            </span>
                          </td>
                          <td className="text-right py-2 md:py-3 px-2 hidden md:table-cell">
                            {formatCurrency(rep.weightedRevenue)}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stages Tab */}
        <TabsContent value="stages" className="space-y-4">
          {/* Stage-wise comparison chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Deals by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {repMetrics.map((rep) => (
                      <Bar
                        key={rep.uid}
                        dataKey={rep.name}
                        fill={rep.color}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stage breakdown table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg">Stage Breakdown Details</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs md:text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 md:py-3 px-3 md:px-4">Stage</th>
                      {repMetrics.map((rep) => (
                        <th
                          key={rep.uid}
                          className="text-center py-2 md:py-3 px-2 md:px-4"
                          colSpan={2}
                        >
                          <div className="flex items-center justify-center gap-1">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: rep.color }}
                            />
                            <span>{rep.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-1 px-3 md:px-4"></th>
                      {repMetrics.map((rep) => (
                        <>
                          <th key={`${rep.uid}-count`} className="text-right py-1 px-2 text-xs">
                            Deals
                          </th>
                          <th key={`${rep.uid}-rev`} className="text-right py-1 px-2 text-xs">
                            Revenue
                          </th>
                        </>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesStages.map((stage) => (
                      <tr key={stage.name} className="border-b hover:bg-muted/20">
                        <td className="py-2 md:py-3 px-3 md:px-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="font-medium">{stage.name}</span>
                          </div>
                        </td>
                        {repMetrics.map((rep) => {
                          const stageData = rep.stageBreakdown.find(
                            (s) => s.stage === stage.name
                          )
                          return (
                            <>
                              <td
                                key={`${rep.uid}-${stage.name}-count`}
                                className="text-right py-2 md:py-3 px-2"
                              >
                                {stageData?.count || 0}
                              </td>
                              <td
                                key={`${rep.uid}-${stage.name}-rev`}
                                className="text-right py-2 md:py-3 px-2"
                              >
                                <span className="hidden sm:inline">
                                  {formatCurrency(stageData?.revenue || 0)}
                                </span>
                                <span className="sm:hidden">
                                  {formatCompactNumber(stageData?.revenue || 0)}
                                </span>
                              </td>
                            </>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold">
                      <td className="py-2 md:py-3 px-3 md:px-4">Total</td>
                      {repMetrics.map((rep) => (
                        <>
                          <td
                            key={`${rep.uid}-total-count`}
                            className="text-right py-2 md:py-3 px-2"
                          >
                            {rep.totalAccounts}
                          </td>
                          <td
                            key={`${rep.uid}-total-rev`}
                            className="text-right py-2 md:py-3 px-2"
                          >
                            <span className="hidden sm:inline">
                              {formatCurrency(rep.totalRevenue)}
                            </span>
                            <span className="sm:hidden">
                              {formatCompactNumber(rep.totalRevenue)}
                            </span>
                          </td>
                        </>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
