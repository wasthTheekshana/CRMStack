import { useState, useEffect, useMemo } from 'react'
import { Phone, Mail, Calendar, FileText, ArrowRight, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { getActivities, type ActivityFilters } from '@/services/activityService'
import { getAllUsers } from '@/services/userService'
import { Activity, User } from '@/types'
import { formatRelativeTime } from '@/lib/utils/formatters'

const activityIcons: Record<string, typeof Phone> = {
  note: MessageSquare, stage_change: ArrowRight, call: Phone, email: Mail, meeting: Calendar,
}
const activityColors: Record<string, string> = {
  note: 'bg-blue-100 text-blue-600',
  stage_change: 'bg-purple-100 text-purple-600',
  call: 'bg-green-100 text-green-600',
  email: 'bg-orange-100 text-orange-600',
  meeting: 'bg-pink-100 text-pink-600',
}

type DatePreset = 'all' | 'today' | 'week' | 'month'

function presetRange(preset: DatePreset): { startDate?: string; endDate?: string } {
  if (preset === 'all') return {}
  const now = new Date()
  const start = new Date(now)
  if (preset === 'today')      start.setHours(0, 0, 0, 0)
  else if (preset === 'week')  start.setDate(now.getDate() - 7)
  else if (preset === 'month') start.setMonth(now.getMonth() - 1)
  return { startDate: start.toISOString() }
}

export function TeamActivity() {
  const [members, setMembers] = useState<User[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [memberId, setMemberId] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [datePreset, setDatePreset] = useState<DatePreset>('month')

  useEffect(() => {
    getAllUsers().then(setMembers).catch(err => console.error('Failed to load members', err))
  }, [])

  useEffect(() => {
    setIsLoading(true)
    const filters: ActivityFilters = {
      ...(memberId !== 'all' && { ownerId: memberId }),
      ...(type !== 'all' && { type }),
      ...presetRange(datePreset),
    }
    getActivities(filters)
      .then(setActivities)
      .catch(err => console.error('Failed to load activities', err))
      .finally(() => setIsLoading(false))
  }, [memberId, type, datePreset])

  const grouped = useMemo(() => {
    const byDay: Record<string, Activity[]> = {}
    for (const a of activities) {
      const day = a.createdAt ? new Date(a.createdAt).toDateString() : 'Unknown'
      ;(byDay[day] ??= []).push(a)
    }
    return Object.entries(byDay)
  }, [activities])

  return (
    <div className="space-y-6" data-testid="team-activity-page">
      <div>
        <h1 className="text-2xl font-bold">Team Activity</h1>
        <p className="text-sm text-muted-foreground">See what each team member has logged.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Member" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {members.map(m => (
              <SelectItem key={m.id ?? m.uid} value={m.id ?? m.uid}>{m.displayName || m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="stage_change">Stage change</SelectItem>
          </SelectContent>
        </Select>

        <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 days</SelectItem>
            <SelectItem value="month">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" /> Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading…</p>
          ) : grouped.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activities match these filters.</p>
          ) : (
            <div className="space-y-6">
              {grouped.map(([day, items]) => (
                <div key={day}>
                  <p className="text-xs font-semibold text-muted-foreground mb-3">{day}</p>
                  <div className="space-y-4">
                    {items.map((a) => {
                      const Icon = activityIcons[a.type] || FileText
                      const color = activityColors[a.type] || 'bg-gray-100 text-gray-600'
                      return (
                        <div key={a.id} className="flex gap-3">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{a.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.ownerName || 'Unknown'} · {a.createdAt ? formatRelativeTime(a.createdAt) : ''}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
