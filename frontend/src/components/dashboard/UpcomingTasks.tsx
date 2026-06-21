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

// Filter chips: "all" plus the actionable task types.
const FILTERS: { value: 'all' | TaskType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'call', label: 'Calls' },
  { value: 'meeting', label: 'Meetings' },
  { value: 'follow-up', label: 'Follow-ups' },
  { value: 'email', label: 'Emails' },
]

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

// Overdue/Today status (tasks only); null when the due date is in the future.
function dueStatus(dueDate: string): { label: string; className: string } | null {
  const due = startOfDay(new Date(dueDate))
  const today = startOfDay(new Date())
  if (due < today) return { label: 'Overdue', className: 'bg-red-100 text-red-700' }
  if (due.getTime() === today.getTime()) return { label: 'Today', className: 'bg-amber-100 text-amber-700' }
  return null
}

export function UpcomingTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | TaskType>('all')

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

  const visible = useMemo(
    () => (filter === 'all' ? pending : pending.filter((t) => t.type === filter)),
    [pending, filter]
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
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {filter === 'all' ? 'No upcoming tasks' : `No ${filter === 'follow-up' ? 'follow-ups' : filter + 's'} coming up`}
          </p>
        ) : (
          <div className="space-y-4">
            {visible.map((task) => {
              const Icon = typeIcons[task.type] || FileText
              const color = typeColors[task.type] || 'bg-gray-100 text-gray-600'
              const status = dueStatus(task.dueDate as string)
              return (
                <div key={task.id} className="flex gap-3 items-start">
                  <div className={cn('h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0', color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {task.type} · Due {fullDate(task.dueDate as string)}
                    </p>
                  </div>
                  {status && (
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', status.className)}>
                      {status.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
