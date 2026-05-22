import { useState, useEffect } from 'react'
import { Plus, Phone, Mail, Users, FileText, RefreshCw, Loader2, Trash2, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getActivitiesByLead, createActivity } from '@/services/activityService'
import { getTasksByLead, createTask, completeTask, deleteTask } from '@/services/taskService'
import { useAuthStore } from '@/store/authStore'
import type { Activity, Task, ActivityType, TaskType } from '@/models'

const ACTIVITY_ICONS: Record<ActivityType, JSX.Element> = {
  call:         <Phone     className="h-4 w-4" />,
  email:        <Mail      className="h-4 w-4" />,
  meeting:      <Users     className="h-4 w-4" />,
  note:         <FileText  className="h-4 w-4" />,
  stage_change: <RefreshCw className="h-4 w-4" />,
}

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  call:         'bg-blue-100 text-blue-700',
  email:        'bg-purple-100 text-purple-700',
  meeting:      'bg-green-100 text-green-700',
  note:         'bg-yellow-100 text-yellow-700',
  stage_change: 'bg-gray-100 text-gray-600',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface Props {
  leadId: string
}

export function ActivityTasksTab({ leadId }: Props) {
  const user = useAuthStore((state) => state.user)

  const [activities, setActivities] = useState<Activity[]>([])
  const [tasks,      setTasks]      = useState<Task[]>([])
  const [loading,    setLoading]    = useState(true)

  // Task form state
  const [showTaskForm,  setShowTaskForm]  = useState(false)
  const [taskTitle,     setTaskTitle]     = useState('')
  const [taskType,      setTaskType]      = useState<TaskType>('follow-up')
  const [taskDueDate,   setTaskDueDate]   = useState('')
  const [savingTask,    setSavingTask]    = useState(false)

  // Activity form state
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [actType,          setActType]          = useState<ActivityType>('call')
  const [actDescription,   setActDescription]   = useState('')
  const [savingActivity,   setSavingActivity]   = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      getActivitiesByLead(leadId),
      getTasksByLead(leadId),
    ]).then(([acts, tsks]) => {
      if (cancelled) return
      setActivities(acts)
      setTasks(tsks)
    }).catch(() => {
      if (!cancelled) toast.error('Failed to load activity data')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [leadId])

  async function handleCreateTask() {
    if (!taskTitle.trim() || !taskDueDate) return
    setSavingTask(true)
    try {
      const task = await createTask({
        leadId,
        title: taskTitle.trim(),
        type: taskType,
        dueDate: taskDueDate,
        description: '',
        status: 'pending',
        priority: 'medium',
        ownerId: user?.id ?? '',
      })
      setTasks(prev => [...prev, task].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()))
      setTaskTitle('')
      setTaskDueDate('')
      setTaskType('follow-up')
      setShowTaskForm(false)
      toast.success('Task created')
    } catch {
      toast.error('Failed to create task')
    } finally {
      setSavingTask(false)
    }
  }

  async function handleCompleteTask(taskId: string) {
    try {
      const updated = await completeTask(taskId)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
    } catch {
      toast.error('Failed to complete task')
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await deleteTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch {
      toast.error('Failed to delete task')
    }
  }

  async function handleLogActivity() {
    if (!actDescription.trim()) return
    setSavingActivity(true)
    try {
      const act = await createActivity({ leadId, type: actType, description: actDescription.trim(), ownerId: user?.id ?? '' })
      setActivities(prev => [act, ...prev])
      setActDescription('')
      setActType('call')
      setShowActivityForm(false)
      toast.success('Activity logged')
    } catch {
      toast.error('Failed to log activity')
    } finally {
      setSavingActivity(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const pendingTasks = tasks.filter(t => t.status !== 'completed')
  const doneTasks    = tasks.filter(t => t.status === 'completed')

  return (
    <div className="space-y-6 py-2">

      {/* ── Tasks section ──────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Tasks
            {pendingTasks.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingTasks.length}</Badge>
            )}
          </h3>
          {!showTaskForm && (
            <Button size="sm" variant="outline" onClick={() => setShowTaskForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Task
            </Button>
          )}
        </div>

        {showTaskForm && (
          <div className="border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
            <Input
              placeholder="Task title"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
            />
            <div className="flex gap-2">
              <Select value={taskType} onValueChange={v => setTaskType(v as TaskType)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                className="flex-1"
                value={taskDueDate}
                onChange={e => setTaskDueDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowTaskForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreateTask} disabled={savingTask || !taskTitle.trim() || !taskDueDate}>
                {savingTask ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {pendingTasks.length === 0 && !showTaskForm && (
            <p className="text-xs text-muted-foreground py-2">No pending tasks.</p>
          )}
          {pendingTasks.map(task => (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                task.status === 'overdue' ? 'bg-red-50 border-red-200' : 'bg-background'
              }`}
            >
              <button
                onClick={() => handleCompleteTask(task.id)}
                className="mt-0.5 text-muted-foreground hover:text-primary flex-shrink-0"
                title="Mark complete"
              >
                <CheckSquare className="h-4 w-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{task.title}</p>
                <p className={`text-xs mt-0.5 ${task.status === 'overdue' ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {task.status === 'overdue' ? '⚠ Overdue · ' : ''}
                  {task.type} · Due {new Date(task.dueDate).toLocaleDateString()}
                </p>
              </div>
              {task.ownerId === user?.id && (
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  title="Delete task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          {doneTasks.length > 0 && (
            <details className="text-xs text-muted-foreground cursor-pointer">
              <summary className="py-1 select-none">{doneTasks.length} completed</summary>
              <div className="space-y-1 mt-1">
                {doneTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30 opacity-60">
                    <CheckSquare className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    <span className="line-through text-xs">{task.title}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* ── Activity Log section ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Activity Log</h3>
          {!showActivityForm && (
            <Button size="sm" variant="outline" onClick={() => setShowActivityForm(true)}>
              <Plus className="h-3 w-3 mr-1" /> Log Activity
            </Button>
          )}
        </div>

        {showActivityForm && (
          <div className="border rounded-lg p-3 mb-3 space-y-2 bg-muted/30">
            <Select value={actType} onValueChange={v => setActType(v as ActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              placeholder="What happened?"
              value={actDescription}
              onChange={e => setActDescription(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowActivityForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleLogActivity} disabled={savingActivity || !actDescription.trim()}>
                {savingActivity ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Log'}
              </Button>
            </div>
          </div>
        )}

        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {activities.map(act => (
              <div key={act.id} className="flex gap-3">
                <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${ACTIVITY_COLORS[act.type as ActivityType]}`}>
                  {ACTIVITY_ICONS[act.type as ActivityType]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{act.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {act.type === 'stage_change' ? 'Auto' : (act.ownerName ?? 'Unknown')}
                    {' · '}
                    {act.createdAt ? timeAgo(act.createdAt) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
