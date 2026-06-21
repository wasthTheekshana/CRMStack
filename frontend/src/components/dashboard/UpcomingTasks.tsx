import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Mail, Calendar, ArrowRight, FileText, ListTodo } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getTasks } from '@/services/taskService'
import { Task, TaskType } from '@/types'
import { cn } from '@/lib/utils/cn'
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus'

const typeIcons: Record<string, typeof Phone> = {
  call: Phone,
  meeting: Calendar,
  email: Mail,
  'follow-up': ArrowRight,
  other: FileText,
}

const typeColors: Record<string, string> = {
  call: 'bg-green-100 text-green-600',
  meeting: 'bg-pink-100 text-pink-600',
  email: 'bg-orange-100 text-orange-600',
  'follow-up': 'bg-purple-100 text-purple-600',
  other: 'bg-gray-100 text-gray-600',
}

// Type sections, in display order.
const TYPE_GROUPS: { type: TaskType; label: string }[] = [
  { type: 'call', label: 'Calls' },
  { type: 'meeting', label: 'Meetings' },
  { type: 'follow-up', label: 'Follow-ups' },
  { type: 'email', label: 'Emails' },
  { type: 'other', label: 'Other' },
]

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// Returns the due-date badge text + style based on the due date vs today.
function dueBadge(dueDate: string): { label: string; className: string } {
  const due = startOfDay(new Date(dueDate))
  const today = startOfDay(new Date())
  if (due < today) return { label: 'Overdue', className: 'bg-red-100 text-red-700' }
  if (due.getTime() === today.getTime()) return { label: 'Today', className: 'bg-amber-100 text-amber-700' }
  return {
    label: new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    className: 'bg-muted text-muted-foreground',
  }
}

export function UpcomingTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadTasks = useCallback(() => {
    getTasks()
      .then(setTasks)
      .catch((err) => console.error('Failed to load tasks', err))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])
  // Refresh when the user returns to the tab/page so newly added tasks appear.
  useRefreshOnFocus(loadTasks)

  // Pending (not completed) tasks, soonest due first; overdue surfaces at the top.
  const pending = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'completed')
        .sort((a, b) => new Date(a.dueDate as string).getTime() - new Date(b.dueDate as string).getTime()),
    [tasks]
  )

  // Group pending tasks by type, preserving the section order above.
  const sections = useMemo(
    () =>
      TYPE_GROUPS
        .map((g) => ({ ...g, items: pending.filter((t) => t.type === g.type) }))
        .filter((g) => g.items.length > 0),
    [pending]
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <ListTodo className="h-5 w-5" />
          Upcoming Tasks
        </CardTitle>
        <Link to="/tasks" className="text-xs text-primary hover:underline">
          View all
        </Link>
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
        ) : sections.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No upcoming tasks</p>
        ) : (
          <div className="space-y-5">
            {sections.map((section) => {
              const Icon = typeIcons[section.type] || FileText
              const color = typeColors[section.type] || 'bg-gray-100 text-gray-600'
              return (
                <div key={section.type}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    {section.label} ({section.items.length})
                  </p>
                  <div className="space-y-3">
                    {section.items.map((task) => {
                      const badge = dueBadge(task.dueDate as string)
                      return (
                        <div key={task.id} className="flex gap-3 items-start">
                          <div className={cn('h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0', color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {task.description && (
                              <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                            )}
                          </div>
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', badge.className)}>
                            {badge.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
