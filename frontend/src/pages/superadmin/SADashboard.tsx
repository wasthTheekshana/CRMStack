import { useEffect, useState } from 'react'
import {
  Building2, Users, TrendingUp, AlertCircle, Loader2,
  DollarSign, BarChart2, Activity, CalendarPlus, Layers,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { saGetStats, SAStats } from '@/services/saService'

// ─── Colour palette for pie chart ────────────────────────────────────────────
const PLAN_COLORS: Record<string, string> = {
  starter:    '#6366f1',
  pro:        '#8b5cf6',
  business:   '#8b5cf6',
  enterprise: '#06b6d4',
}
const FALLBACK_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b']

function planColor(plan: string, idx: number) {
  return PLAN_COLORS[plan] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
    trial:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
    cancelled: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status] ?? map.cancelled}`}>
      {status}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  accent: string   // tailwind bg class for icon background
  iconColor: string
  sub?: string
}

function StatCard({ label, value, icon: Icon, accent, iconColor, sub }: StatCardProps) {
  return (
    <Card className="bg-slate-800/60 border-slate-700 hover:border-slate-600 transition-colors">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {sub && <p className="text-xs text-slate-500">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${accent}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Custom bar tooltip ───────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-semibold">{payload[0].value} new tenant{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function SADashboard() {
  const [stats, setStats]     = useState<SAStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    saGetStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg p-4">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  const pieData = Object.entries(stats?.planCounts ?? {}).map(([plan, count]) => ({
    name: plan.charAt(0).toUpperCase() + plan.slice(1),
    value: count,
    plan,
  }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Platform-wide overview across all tenants</p>
      </div>

      {/* Primary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Tenants"
          value={stats?.active ?? 0}
          icon={Building2}
          accent="bg-emerald-500/10"
          iconColor="text-emerald-400"
          sub={`${stats?.trial ?? 0} on trial`}
        />
        <StatCard
          label="Est. MRR"
          value={`$${(stats?.estimatedMRR ?? 0).toLocaleString()}`}
          icon={DollarSign}
          accent="bg-indigo-500/10"
          iconColor="text-indigo-400"
          sub="based on active plans"
        />
        <StatCard
          label="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          accent="bg-blue-500/10"
          iconColor="text-blue-400"
          sub="across all tenants"
        />
        <StatCard
          label="Total Leads"
          value={stats?.totalLeads ?? 0}
          icon={Layers}
          accent="bg-purple-500/10"
          iconColor="text-purple-400"
          sub="active (not deleted)"
        />
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="New This Month"
          value={stats?.newThisMonth ?? 0}
          icon={CalendarPlus}
          accent="bg-cyan-500/10"
          iconColor="text-cyan-400"
        />
        <StatCard
          label="Total Activities"
          value={(stats?.totalActivities ?? 0).toLocaleString()}
          icon={Activity}
          accent="bg-teal-500/10"
          iconColor="text-teal-400"
          sub="calls, notes, meetings"
        />
        <StatCard
          label="Suspended"
          value={stats?.suspended ?? 0}
          icon={AlertCircle}
          accent="bg-red-500/10"
          iconColor="text-red-400"
        />
        <StatCard
          label="Total Tenants"
          value={stats?.total ?? 0}
          icon={BarChart2}
          accent="bg-slate-600/40"
          iconColor="text-slate-300"
          sub="all statuses"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Growth — takes 2/3 width */}
        <Card className="bg-slate-800/60 border-slate-700 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              Tenant Growth — Last 6 Months
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(stats?.monthlyGrowth ?? []).length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                No growth data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats?.monthlyGrowth ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Plan distribution — takes 1/3 width */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-400" />
              Tenants by Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                No plan data
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, idx) => (
                        <Cell key={entry.plan} fill={planColor(entry.plan, idx)} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, fontSize: 12 }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
                  {pieData.map((entry, idx) => (
                    <div key={entry.plan} className="flex items-center gap-1.5 text-xs">
                      <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: planColor(entry.plan, idx) }} />
                      <span className="text-slate-400 capitalize">{entry.name}</span>
                      <span className="text-white font-semibold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent tenants */}
      {(stats?.recentTenants ?? []).length > 0 && (
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-cyan-400" />
              Recently Joined Tenants
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-400 font-medium px-6 py-2.5 text-xs uppercase tracking-wider">Tenant</th>
                    <th className="text-left text-slate-400 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Plan</th>
                    <th className="text-left text-slate-400 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left text-slate-400 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.recentTenants.map((t, idx) => (
                    <tr key={t.id} className={idx < (stats.recentTenants.length - 1) ? 'border-b border-slate-700/50' : ''}>
                      <td className="px-6 py-3 font-medium text-white">{t.name}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300 capitalize">{t.plan}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
