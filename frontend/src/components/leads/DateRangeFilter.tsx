import { CalendarDays, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'
import { EMPTY_DATE_RANGE, isDateRangeActive, type DateRange } from '@/lib/utils/leadFilters'

interface DateRangeFilterProps {
  label: string
  value: DateRange
  onChange: (range: DateRange) => void
  /** Stack the label above full-width inputs (used inside the mobile filter sheet). */
  stacked?: boolean
  className?: string
}

/** A from–to date picker. Both ends are optional and inclusive. */
export function DateRangeFilter({ label, value, onChange, stacked = false, className }: DateRangeFilterProps) {
  const active = isDateRangeActive(value)

  const fromInput = (
    <Input
      type="date"
      aria-label={`${label} from`}
      value={value.from}
      max={value.to || undefined}
      onChange={(e) => onChange({ ...value, from: e.target.value })}
      className={cn('h-9', stacked ? 'min-w-0' : 'w-[140px]')}
    />
  )
  const toInput = (
    <Input
      type="date"
      aria-label={`${label} to`}
      value={value.to}
      min={value.from || undefined}
      onChange={(e) => onChange({ ...value, to: e.target.value })}
      className={cn('h-9', stacked ? 'min-w-0' : 'w-[140px]')}
    />
  )
  const clearButton = active && (
    <button
      type="button"
      aria-label={`Clear ${label} filter`}
      onClick={() => onChange(EMPTY_DATE_RANGE)}
      className="text-muted-foreground hover:text-foreground"
    >
      <X className="h-4 w-4" />
    </button>
  )

  // Narrow layout (mobile filter sheet): label, then From and To on their own full-width rows.
  if (stacked) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {label}
          </span>
          {clearButton}
        </div>
        <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-2">
          <span className="text-xs text-muted-foreground">From</span>
          {fromInput}
          <span className="text-xs text-muted-foreground">To</span>
          {toInput}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-xs font-medium whitespace-nowrap flex items-center gap-1 text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        {label}
      </span>
      <div className="flex items-center gap-2">
        {fromInput}
        <span className="text-xs text-muted-foreground">to</span>
        {toInput}
        {clearButton}
      </div>
    </div>
  )
}
