import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { CustomFieldConfig } from '@/store/tenantStore'
import { toast } from 'sonner'

interface LeadFieldSettingsProps {
  customFields:  CustomFieldConfig[]
  visibleFields: Record<string, boolean>
  onChangeCustom:  (fields: CustomFieldConfig[]) => void
  onChangeVisible: (fields: Record<string, boolean>) => void
  isSaving: boolean
  onSave:   () => void
}

const STANDARD_FIELDS: { key: string; label: string }[] = [
  { key: 'imageCount',  label: 'Image Count' },
  { key: 'boxCount',    label: 'Box Count' },
  { key: 'hoUpdate',    label: 'HO Update' },
  { key: 'probability', label: 'Probability' },
  { key: 'remarks',     label: 'Remarks' },
]

const FIELD_TYPES = ['text', 'number', 'select', 'date', 'checkbox'] as const

function generateId() {
  return `cf${Date.now()}`
}

function blankField(): CustomFieldConfig {
  return { id: generateId(), name: '', type: 'text', required: false, options: [] }
}

export function LeadFieldSettings({
  customFields, visibleFields,
  onChangeCustom, onChangeVisible,
  isSaving, onSave,
}: LeadFieldSettingsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newOption, setNewOption] = useState<Record<string, string>>({})

  const addField = () => {
    const field = blankField()
    onChangeCustom([...customFields, field])
    setExpandedId(field.id)
  }

  const updateField = (id: string, patch: Partial<CustomFieldConfig>) => {
    onChangeCustom(customFields.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  const removeField = (id: string) => {
    onChangeCustom(customFields.filter(f => f.id !== id))
  }

  const addOption = (fieldId: string) => {
    const val = newOption[fieldId]?.trim()
    if (!val) return
    const field = customFields.find(f => f.id === fieldId)
    if (!field) return
    if (field.options.includes(val)) {
      toast.error('Option already exists')
      return
    }
    updateField(fieldId, { options: [...field.options, val] })
    setNewOption(p => ({ ...p, [fieldId]: '' }))
  }

  const removeOption = (fieldId: string, opt: string) => {
    const field = customFields.find(f => f.id === fieldId)
    if (!field) return
    updateField(fieldId, { options: field.options.filter(o => o !== opt) })
  }

  return (
    <div className="space-y-6">
      {/* Standard field visibility toggles */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Standard Fields</h3>
        <div className="space-y-2">
          {STANDARD_FIELDS.map(f => (
            <div key={f.key} className="flex items-center justify-between py-2 border-b last:border-0">
              <Label className="text-sm">{f.label}</Label>
              <Switch
                checked={visibleFields[f.key] !== false}
                onCheckedChange={checked =>
                  onChangeVisible({ ...visibleFields, [f.key]: checked })
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Custom fields */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Custom Fields</h3>
          <Button onClick={addField} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Add Field
          </Button>
        </div>

        <div className="space-y-2">
          {customFields.map(field => (
            <Card key={field.id}>
              <CardHeader className="p-3 pb-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={field.name}
                    onChange={e => updateField(field.id, { name: e.target.value })}
                    placeholder="Field name"
                    className="h-7 text-sm flex-1"
                  />
                  <Select
                    value={field.type}
                    onValueChange={val => updateField(field.id, { type: val as CustomFieldConfig['type'] })}
                  >
                    <SelectTrigger className="h-7 text-xs w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Label className="text-xs text-muted-foreground">Req</Label>
                    <Switch
                      checked={field.required}
                      onCheckedChange={v => updateField(field.id, { required: v })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setExpandedId(expandedId === field.id ? null : field.id)}
                  >
                    {expandedId === field.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removeField(field.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              {expandedId === field.id && field.type === 'select' && (
                <CardContent className="p-3 pt-2">
                  <Label className="text-xs text-muted-foreground mb-2 block">Options</Label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {field.options.map(opt => (
                      <div key={opt} className="flex items-center gap-1 bg-muted rounded px-2 py-0.5 text-xs">
                        {opt}
                        <button onClick={() => removeOption(field.id, opt)} className="text-muted-foreground hover:text-destructive">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newOption[field.id] ?? ''}
                      onChange={e => setNewOption(p => ({ ...p, [field.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addOption(field.id) }}
                      placeholder="Add option…"
                      className="h-7 text-sm flex-1"
                    />
                    <Button size="sm" variant="outline" className="h-7" onClick={() => addOption(field.id)}>
                      Add
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Saving…' : 'Save Lead Fields'}
      </Button>
    </div>
  )
}
