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
import { Activity } from '@/types'
import { getActivities } from '@/lib/api/collections'
import { useAuthStore, useIsAdmin } from '@/store/authStore'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

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

// Type sections, in display order.
const TYPE_GROUPS: { type: keyof typeof activityIcons; label: string }[] = [
  { type: 'call', label: 'Calls' },
  { type: 'meeting', label: 'Meetings' },
  { type: 'email', label: 'Emails' },
  { type: 'note', label: 'Notes' },
  { type: 'stage_change', label: 'Stage changes' },
]

export function RecentActivities() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
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

  // Group the recent activities by type, preserving the section order above.
  const sections = useMemo(
    () =>
      TYPE_GROUPS
        .map((g) => ({ ...g, items: activities.filter((a) => a.type === g.type) }))
        .filter((g) => g.items.length > 0),
    [activities]
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
        ) : sections.length > 0 ? (
          <div className="space-y-5">
            {sections.map((section) => {
              const Icon = activityIcons[section.type] || FileText
              const colorClass = activityColors[section.type] || 'bg-gray-100 text-gray-600'
              return (
                <div key={section.type}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {section.label} ({section.items.length})
                  </p>
                  <div className="space-y-3">
                    {section.items.map((activity) => (
                      <div key={activity.id} className="flex gap-3">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {activity.createdAt ? formatRelativeTime(activity.createdAt) : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activities
          </p>
        )}
      </CardContent>
    </Card>
  )
}
