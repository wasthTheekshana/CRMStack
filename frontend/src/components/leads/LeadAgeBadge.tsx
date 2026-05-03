import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { getLeadAgeDays, formatLeadAge } from '@/lib/utils/leadAge'

interface Props {
  createdAt: string | undefined
  className?: string
}

export function LeadAgeBadge({ createdAt, className }: Props) {
  const days = getLeadAgeDays(createdAt)

  const colourClass =
    days >= 90 ? 'bg-red-100 text-red-700' :
    days >= 60 ? 'bg-orange-100 text-orange-700' :
    days >= 30 ? 'bg-amber-100 text-amber-700' :
                 'bg-slate-100 text-slate-600'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        colourClass,
        className
      )}
    >
      <Clock className="h-3 w-3" />
      Open {formatLeadAge(createdAt)}
    </span>
  )
}
