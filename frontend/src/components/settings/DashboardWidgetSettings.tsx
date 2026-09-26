import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { DashboardWidget, FieldConfig } from '@/store/tenantStore'

interface DashboardWidgetSettingsProps {
  widgets:      DashboardWidget[]
  customFields: FieldConfig[]
  onChange:     (widgets: DashboardWidget[]) => void
  isSaving:     boolean
  onSave:       () => void
}

const WIDGET_TYPES = [
  { value: 'sum',      label: 'Sum' },
  { value: 'average',  label: 'Average' },
  { value: 'count',    label: 'Count' },
  { value: 'min',      label: 'Min' },
  { value: 'max',      label: 'Max' },
  { value: 'group_by', label: 'Group By' },
] as const

const CHART_TYPES = [
  { value: 'number', label: 'KPI Card' },
  { value: 'bar',    label: 'Bar Chart' },
  { value: 'pie',    label: 'Pie Chart' },
  { value: 'table',  label: 'Table' },
] as const

const ROLES = [
  { value: 'both',  label: 'Both' },
  { value: 'admin', label: 'Admin Only' },
  { value: 'sales', label: 'Sales Only' },
] as const

export function DashboardWidgetSettings({
  widgets, customFields, onChange, isSaving, onSave,
}: DashboardWidgetSettingsProps) {
  const numericFields = customFields.filter(f => f.type === 'number' || f.type === 'formula')
  const selectFields  = customFields.filter(f => f.type === 'select')

  const addWidget = () => {
    const widget: DashboardWidget = {
      id:         `wgt_${Date.now()}`,
      name:       '',
      type:       'sum',
      field_id:   numericFields[0]?.id ?? '',
      chart_type: 'number',
      order:      widgets.length,
      role:       'both',
    }
    onChange([...widgets, widget])
  }

  const updateWidget = (id: string, patch: Partial<DashboardWidget>) => {
    onChange(widgets.map(w => w.id === id ? { ...w, ...patch } : w))
  }

  const removeWidget = (id: string) => {
    onChange(widgets.filter(w => w.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Dashboard Widgets</h3>
        <Button onClick={addWidget} size="sm" variant="outline" disabled={numericFields.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Add Widget
        </Button>
      </div>

      {numericFields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add numeric or formula custom fields first to create dashboard widgets.
        </p>
      )}

      <div className="space-y-3">
        {widgets.map(widget => (
          <Card key={widget.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={widget.name}
                  onChange={e => updateWidget(widget.id, { name: e.target.value })}
                  placeholder="Widget name"
                  className="flex-1"
                />
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeWidget(widget.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Aggregation</Label>
                  <Select value={widget.type} onValueChange={v => updateWidget(widget.id, { type: v as DashboardWidget['type'] })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WIDGET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Field</Label>
                  <Select value={widget.field_id} onValueChange={v => updateWidget(widget.id, { field_id: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {numericFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {widget.type === 'group_by' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Group By</Label>
                    <Select value={widget.group_by_field ?? ''} onValueChange={v => updateWidget(widget.id, { group_by_field: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select field" /></SelectTrigger>
                      <SelectContent>
                        {selectFields.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Chart Type</Label>
                  <Select value={widget.chart_type} onValueChange={v => updateWidget(widget.id, { chart_type: v as DashboardWidget['chart_type'] })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHART_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Visible To</Label>
                  <Select value={widget.role} onValueChange={v => updateWidget(widget.id, { role: v as DashboardWidget['role'] })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={onSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Saving…' : 'Save Widgets'}
      </Button>
    </div>
  )
}
