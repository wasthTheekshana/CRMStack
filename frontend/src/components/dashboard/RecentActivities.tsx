import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Phone,
  Mail,
  Calendar,
  FileText,
  ArrowRight,
  MessageSquare,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/utils/formatters'
import { Activity, ActivityType } from '@/types'
import { getActivities } from '@/lib/api/collections'
import { useAuthStore, useIsAdmin } from '@/store/authStore'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'
import { cn } from '@/lib/utils/cn'

const activityIcons = {
  note: MessageSquare,
  stage_change: ArrowRight,
  call: Phone,
  email: Mail,
  meeting: Calendar,
}

const activityColors = {
  note: 'bg-blue-100 text-blue-600',
  stage_change: 'bg-purple-100 text-purple-600',
  call: 'bg-green-100 text-green-600',
  email: 'bg-orange-100 text-orange-600',
  meeting: 'bg-pink-100 text-pink-600',
}

// Filter chips: "all" plus the manual activity types.
const FILTERS: { value: 'all' | ActivityType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'call', label: 'Calls' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'email', label: 'Emails' },
  { value: 'note', label: 'Notes' },
]

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

export function RecentActivities() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | ActivityType>('all')
  const { user } = useAuthStore()
  const isAdmin = useIsAdmin()

  const fetchActivities = useCallback(async () => {
    if (!user) return
    try {
      const all = await getActivities()
      const scoped = isAdmin ? all : all.filter(a => a.ownerId === user.id)
      setActivities(scoped.slice(0, 20))
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user, isAdmin])

  useEffect(() => { fetchActivities() }, [fetchActivities])
  // Refresh when the user returns to the tab/page so newly logged activities appear.
  useRefreshOnFocus(fetchActivities)

  const visible = useMemo(
    () => (filter === 'all' ? activities : activities.filter((a) => a.type === filter)),
    [activities, filter]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Type filter chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length > 0 ? (
          <div className="space-y-4">
            {visible.map((activity) => {
              const Icon = activityIcons[activity.type] || FileText
              const colorClass = activityColors[activity.type] || 'bg-gray-100 text-gray-600'
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.createdAt
                        ? `${fullDate(activity.createdAt)} · ${formatRelativeTime(activity.createdAt)}`
                        : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {filter === 'all' ? 'No recent activities' : `No ${filter}s`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
