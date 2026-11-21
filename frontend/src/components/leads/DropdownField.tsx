import { X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CustomFieldConfig } from '@/services/tenantService'

interface DropdownFieldProps {
  field: CustomFieldConfig
  /** Stored value; '' means nothing chosen. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * A custom field of type "dropdown" (stored as `select`).
 * - A chosen value can be cleared with the ✕ button.
 * - A stored value that is no longer in the option list (option removed, or the field was
 *   converted from text) is still shown instead of an empty box, and marked "not in list".
 */
export function DropdownField({ field, value, onChange, disabled }: DropdownFieldProps) {
  const orphan = value !== '' && !field.options.includes(value)
  return (
    <div className="flex items-center gap-1">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={`cf_${field.id}`} className="flex-1">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {orphan && <SelectItem value={value}>{value} (not in list)</SelectItem>}
          {field.options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== '' && !disabled && (
        <button
          type="button"
          aria-label={`Clear ${field.name}`}
          title="Clear"
          onClick={() => onChange('')}
          className="h-10 w-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
