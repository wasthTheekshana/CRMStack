import { useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FieldConfig, FieldGroup, CoreFieldVisibility } from '@/store/tenantStore'
import { evaluateFormula } from '@/lib/utils/formulaEngine'
import { toast } from 'sonner'

interface LeadFieldSettingsProps {
  customFields:        FieldConfig[]
  fieldGroups:         FieldGroup[]
  coreFieldVisibility: CoreFieldVisibility
  onChangeCustom:      (fields: FieldConfig[]) => void
  onChangeGroups:      (groups: FieldGroup[]) => void
  onChangeCoreVis:     (vis: CoreFieldVisibility) => void
  isSaving:            boolean
  onSave:              () => void
}

const FIELD_TYPES = ['text', 'textarea', 'number', 'select', 'date', 'checkbox', 'formula'] as const

function generateId(prefix = 'cf') {
  return `${prefix}${Date.now()}`
}

function blankField(groupId?: string): FieldConfig {
  return {
    id:       generateId(),
    name:     '',
    type:     'text',
    required: false,
    options:  [],
    order:    0,
    group:    groupId,
  }
}

function blankGroup(order: number): FieldGroup {
  return { id: generateId('grp'), name: 'New Group', order }
}

export function LeadFieldSettings({
  customFields,
  fieldGroups,
  coreFieldVisibility,
  onChangeCustom,
  onChangeGroups,
  onChangeCoreVis,
  isSaving,
  onSave,
}: LeadFieldSettingsProps) {
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [newOption,   setNewOption]   = useState<Record<string, string>>({})
  const [editingGrp,  setEditingGrp]  = useState<string | null>(null)
  const [grpName,     setGrpName]     = useState('')

  // ── Field helpers ─────────────────────────────────────────────────────────
  const addField = (groupId?: string) => {
    const field = blankField(groupId)
    onChangeCustom([...customFields, field])
    setExpandedId(field.id)
  }

  const updateField = (id: string, patch: Partial<FieldConfig>) => {
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

  // ── Group helpers ──────────────────────────────────────────────────────────
  const addGroup = () => {
    const g = blankGroup(fieldGroups.length)
    onChangeGroups([...fieldGroups, g])
    setEditingGrp(g.id)
    setGrpName(g.name)
  }

  const saveGroupName = (id: string) => {
    const trimmed = grpName.trim()
    if (!trimmed) { setEditingGrp(null); return }
    onChangeGroups(fieldGroups.map(g => g.id === id ? { ...g, name: trimmed } : g))
    setEditingGrp(null)
  }

  const removeGroup = (id: string) => {
    // Unassign fields in this group
    onChangeCustom(customFields.map(f => f.group === id ? { ...f, group: undefined } : f))
    onChangeGroups(fieldGroups.filter(g => g.id !== id))
  }

  const moveGroup = (id: string, dir: 'up' | 'down') => {
    const sorted = [...fieldGroups].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(g => g.id === id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const updated = sorted.map((g, i) => {
      if (i === idx)     return { ...g, order: sorted[swapIdx].order }
      if (i === swapIdx) return { ...g, order: sorted[idx].order }
      return g
    })
    onChangeGroups(updated)
  }

  // ── Render helpers ─────────────────────────────────────────────────────────
  const sortedGroups = [...fieldGroups].sort((a, b) => a.order - b.order)
  const ungroupedFields = customFields.filter(f => !f.group || !fieldGroups.find(g => g.id === f.group))

  const renderFieldCard = (field: FieldConfig) => (
    <Card key={field.id} className="mb-2">
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
            onValueChange={val => updateField(field.id, { type: val as FieldConfig['type'] })}
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
          {/* Group assignment */}
          {fieldGroups.length > 0 && (
            <Select
              value={field.group ?? '__none__'}
              onValueChange={val => updateField(field.id, { group: val === '__none__' ? undefined : val })}
            >
              <SelectTrigger className="h-7 text-xs w-32">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No group</SelectItem>
                {sortedGroups.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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

      {/* Select options editor */}
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

      {/* Number formatting editor */}
      {expandedId === field.id && field.type === 'number' && (
        <CardContent className="p-3 pt-2 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prefix</Label>
              <Input
                value={field.prefix ?? ''}
                onChange={e => updateField(field.id, { prefix: e.target.value })}
                placeholder="e.g. $"
                className="h-7 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Suffix</Label>
              <Input
                value={field.suffix ?? ''}
                onChange={e => updateField(field.id, { suffix: e.target.value })}
                placeholder="e.g. kg"
                className="h-7 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Decimal places</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={field.precision ?? ''}
                onChange={e => updateField(field.id, { precision: e.target.value === '' ? undefined : Number(e.target.value) })}
                placeholder="0"
                className="h-7 text-sm"
              />
            </div>
          </div>
        </CardContent>
      )}

      {/* Formula editor */}
      {expandedId === field.id && field.type === 'formula' && (
        <CardContent className="p-3 pt-2 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Formula Expression</Label>
            <Input
              value={field.formula ?? ''}
              onChange={e => updateField(field.id, { formula: e.target.value })}
              placeholder="e.g. {{cf_qty}} * {{cf_price}}"
              className="font-mono text-sm"
            />
          </div>

          {/* Available field chips */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Insert Field Reference</Label>
            <div className="flex flex-wrap gap-1">
              {customFields
                .filter(f => f.id !== field.id && (f.type === 'number' || f.type === 'formula'))
                .map(f => (
                  <button
                    key={f.id}
                    type="button"
                    className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded"
                    onClick={() => updateField(field.id, {
                      formula: (field.formula ?? '') + `{{${f.id}}}`
                    })}
                  >
                    {f.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-muted rounded p-2 text-xs">
            <span className="text-muted-foreground">Preview: </span>
            <span className="font-mono">
              {(() => {
                try {
                  if (!field.formula) return '—'
                  const sampleValues: Record<string, number> = {}
                  customFields.forEach(f => {
                    if (f.type === 'number' || f.type === 'formula') sampleValues[f.id] = 100
                  })
                  return evaluateFormula(field.formula, sampleValues)
                } catch (e) {
                  return `Error: ${(e as Error).message}`
                }
              })()}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  )

  return (
    <div className="space-y-6">

      {/* ── Probability visibility ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Core Fields</h3>
        <div className="flex items-center justify-between py-2 border-b">
          <Label className="text-sm">Probability</Label>
          <Switch
            checked={coreFieldVisibility.probability !== false}
            onCheckedChange={checked => onChangeCoreVis({ ...coreFieldVisibility, probability: checked })}
          />
        </div>
      </div>

      {/* ── Group management ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Field Groups</h3>
          <Button onClick={addGroup} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Add Group
          </Button>
        </div>

        {fieldGroups.length === 0 && (
          <p className="text-xs text-muted-foreground">No groups yet. Add a group to organise fields.</p>
        )}

        <div className="space-y-2">
          {sortedGroups.map((group, idx) => (
            <div key={group.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
              {editingGrp === group.id ? (
                <Input
                  autoFocus
                  value={grpName}
                  onChange={e => setGrpName(e.target.value)}
                  onBlur={() => saveGroupName(group.id)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGroupName(group.id) }}
                  className="h-7 text-sm flex-1"
                />
              ) : (
                <span
                  className="text-sm font-medium flex-1 cursor-pointer hover:underline"
                  onClick={() => { setEditingGrp(group.id); setGrpName(group.name) }}
                >
                  {group.name}
                </span>
              )}
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                disabled={idx === 0}
                onClick={() => moveGroup(group.id, 'up')}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6"
                disabled={idx === sortedGroups.length - 1}
                onClick={() => moveGroup(group.id, 'down')}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                onClick={() => removeGroup(group.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Custom fields by group ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Custom Fields</h3>
          <Button onClick={() => addField()} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" /> Add Field
          </Button>
        </div>

        {/* Fields in groups */}
        {sortedGroups.map(group => {
          const groupFields = customFields.filter(f => f.group === group.id)
          return (
            <div key={group.id} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.name}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => addField(group.id)}
                >
                  <Plus className="h-3 w-3 mr-0.5" /> Add to group
                </Button>
              </div>
              {groupFields.length === 0 && (
                <p className="text-xs text-muted-foreground pl-1 mb-2">No fields in this group.</p>
              )}
              {groupFields.map(renderFieldCard)}
            </div>
          )
        })}

        {/* Ungrouped fields */}
        {fieldGroups.length > 0 && ungroupedFields.length > 0 && (
          <div className="mb-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground block mb-2">
              Ungrouped
            </span>
            {ungroupedFields.map(renderFieldCard)}
          </div>
        )}

        {/* No groups — flat list */}
        {fieldGroups.length === 0 && (
          <div>{customFields.map(renderFieldCard)}</div>
        )}
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Saving…' : 'Save Lead Fields'}
      </Button>
    </div>
  )
}
