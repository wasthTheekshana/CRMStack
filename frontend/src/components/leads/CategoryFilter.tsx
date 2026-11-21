import { Tag } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import { ALL_CATEGORIES, NO_CATEGORY } from '@/lib/utils/leadFilters'
import type { CustomFieldConfig } from '@/services/tenantService'

interface CategoryFilterProps {
  /** The workspace's "Category" dropdown field. Nothing is rendered without it. */
  field: CustomFieldConfig | undefined
  value: string
  onChange: (value: string) => void
  /** Show the tag icon in front of the dropdown (hidden inside the mobile filter sheet). */
  showIcon?: boolean
  className?: string
}

/** Dropdown that filters by the values of the "Category" field (replaces the sales-rep filter). */
export function CategoryFilter({ field, value, onChange, showIcon = true, className }: CategoryFilterProps) {
  if (!field) return null
  return (
    <div className="flex items-center gap-2">
      {showIcon && <Tag className="h-4 w-4 text-muted-foreground" />}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn('w-[180px]', className)} aria-label={`Filter by ${field.name}`}>
          <SelectValue placeholder={`Filter by ${field.name.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES}>All {field.name === 'Category' ? 'Categories' : field.name}</SelectItem>
          {field.options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
          <SelectItem value={NO_CATEGORY}>Uncategorised</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

/** Human-readable name of a category filter value, for "Showing: …" badges. */
export function categoryLabel(value: string): string {
  if (value === ALL_CATEGORIES) return 'All Categories'
  if (value === NO_CATEGORY) return 'Uncategorised'
  return value
}
