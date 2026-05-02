import { useState } from 'react'
import { Plus, Trash2, GripVertical, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { SalesStageConfig } from '@/store/tenantStore'
import { cn } from '@/lib/utils/cn'

interface PipelineSettingsProps {
  stages:    SalesStageConfig[]
  onChange:  (stages: SalesStageConfig[]) => void
  isSaving:  boolean
  onSave:    () => void
}

const STAGE_COLORS = [
  '#F97316', '#3B82F6', '#8B5CF6', '#A855F7',
  '#EC4899', '#22C55E', '#EF4444', '#06B6D4',
  '#F59E0B', '#84CC16',
]

function generateId() {
  return `s${Date.now()}`
}

export function PipelineSettings({ stages, onChange, isSaving, onSave }: PipelineSettingsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  const addStage = () => {
    const newStage: SalesStageConfig = {
      id:          generateId(),
      name:        'New Stage',
      color:       STAGE_COLORS[stages.length % STAGE_COLORS.length],
      probability: 50,
      order:       stages.length,
      isWon:       false,
    }
    onChange([...stages, newStage])
    setEditingId(newStage.id)
  }

  const updateStage = (id: string, patch: Partial<SalesStageConfig>) => {
    onChange(stages.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  const deleteStage = (id: string) => {
    if (stages.length <= 1) {
      toast.error('You must have at least one stage')
      return
    }
    onChange(stages.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })))
  }

  const setWonStage = (id: string) => {
    onChange(stages.map(s => ({ ...s, isWon: s.id === id })))
  }

  const moveStage = (id: string, direction: 'up' | 'down') => {
    const idx = stages.findIndex(s => s.id === id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === stages.length - 1) return

    const next = [...stages]
    const swap = direction === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next.map((s, i) => ({ ...s, order: i })))
  }

  const wonCount = stages.filter(s => s.isWon).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Define the stages in your sales pipeline. Mark exactly one stage as the "Won" stage for KPI tracking.
          </p>
          {wonCount !== 1 && (
            <p className="text-sm text-destructive mt-1">
              ⚠ Exactly one stage must be marked as Won (currently {wonCount})
            </p>
          )}
        </div>
        <Button onClick={addStage} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add Stage
        </Button>
      </div>

      <div className="space-y-2">
        {stages.map((stage, idx) => (
          <Card key={stage.id} className={cn('transition-all', editingId === stage.id && 'ring-2 ring-primary')}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {/* Drag handle (visual only) */}
                <div className="flex flex-col gap-0.5 cursor-grab opacity-40">
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => moveStage(stage.id, 'up')} disabled={idx === 0}>
                    ▲
                  </Button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => moveStage(stage.id, 'down')} disabled={idx === stages.length - 1}>
                    ▼
                  </Button>
                </div>

                {/* Color dot + color picker */}
                <div className="relative">
                  <div
                    className="h-8 w-8 rounded-full border-2 border-white shadow cursor-pointer"
                    style={{ backgroundColor: stage.color }}
                    title="Click to change color"
                  />
                  <input
                    type="color"
                    value={stage.color}
                    onChange={e => updateStage(stage.id, { color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  {editingId === stage.id ? (
                    <Input
                      value={stage.name}
                      onChange={e => updateStage(stage.id, { name: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                      className="h-7 text-sm"
                    />
                  ) : (
                    <span
                      className="text-sm font-medium cursor-pointer hover:text-primary"
                      onClick={() => setEditingId(stage.id)}
                    >
                      {stage.name}
                    </span>
                  )}
                </div>

                {/* Probability */}
                <div className="flex items-center gap-1 w-24">
                  <Label className="text-xs text-muted-foreground sr-only">%</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={stage.probability}
                    onChange={e => updateStage(stage.id, { probability: Math.min(100, Math.max(0, Number(e.target.value))) })}
                    className="h-7 text-sm w-16"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>

                {/* Won toggle */}
                <Button
                  variant={stage.isWon ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  title={stage.isWon ? 'This is the Won stage' : 'Mark as Won stage'}
                  onClick={() => setWonStage(stage.id)}
                >
                  <Trophy className={cn('h-4 w-4', stage.isWon ? 'text-yellow-300' : 'text-muted-foreground')} />
                </Button>

                {/* Delete */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => deleteStage(stage.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={onSave} disabled={isSaving || wonCount !== 1} className="w-full">
        {isSaving ? 'Saving…' : 'Save Pipeline'}
      </Button>
    </div>
  )
}
