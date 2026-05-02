import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { SolutionConfig } from '@/store/tenantStore'
import { toast } from 'sonner'

interface ProductSettingsProps {
  solutions: SolutionConfig[]
  onChange:  (solutions: SolutionConfig[]) => void
  isSaving:  boolean
  onSave:    () => void
}

function generateId() {
  return `p${Date.now()}`
}

export function ProductSettings({ solutions, onChange, isSaving, onSave }: ProductSettingsProps) {
  const add = () => {
    onChange([...solutions, { id: generateId(), name: 'New Product' }])
  }

  const update = (id: string, name: string) => {
    onChange(solutions.map(s => s.id === id ? { ...s, name } : s))
  }

  const remove = (id: string) => {
    if (solutions.length <= 1) {
      toast.error('You must have at least one product/solution')
      return
    }
    onChange(solutions.filter(s => s.id !== id))
  }

  const move = (id: string, direction: 'up' | 'down') => {
    const idx = solutions.findIndex(s => s.id === id)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === solutions.length - 1) return
    const next = [...solutions]
    const swap = direction === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Product and service categories shown in lead forms.
        </p>
        <Button onClick={add} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add Product
        </Button>
      </div>

      <div className="space-y-2">
        {solutions.map((sol, idx) => (
          <Card key={sol.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 cursor-grab opacity-40">
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => move(sol.id, 'up')} disabled={idx === 0}>▲</Button>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Button variant="ghost" size="icon" className="h-5 w-5 p-0" onClick={() => move(sol.id, 'down')} disabled={idx === solutions.length - 1}>▼</Button>
                </div>

                <Input
                  value={sol.name}
                  onChange={e => update(sol.id, e.target.value)}
                  className="h-7 text-sm flex-1"
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => remove(sol.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Saving…' : 'Save Products'}
      </Button>
    </div>
  )
}
