import { cn } from '@/lib/utils/cn'

interface Props {
  daysUntil: number | null
  className?: string
}

export function ExpiryBadge({ daysUntil, className }: Props) {
  let colourClass: string
  let label: string

  if (daysUntil === null) {
    colourClass = 'bg-gray-100 text-gray-500'
    label = 'No expiry set'
  } else if (daysUntil > 7) {
    colourClass = 'bg-green-100 text-green-700'
    label = `Expires in ${daysUntil} days`
  } else if (daysUntil >= 3) {
    colourClass = 'bg-amber-100 text-amber-700'
    label = `Expires in ${daysUntil} days`
  } else if (daysUntil >= 1) {
    colourClass = 'bg-orange-100 text-orange-700'
    label = `Expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
  } else if (daysUntil === 0) {
    colourClass = 'bg-red-100 text-red-700'
    label = 'Expires today'
  } else {
    colourClass = 'bg-red-100 text-red-700'
    label = `Expired ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} ago`
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        colourClass,
        className
      )}
    >
      {label}
    </span>
  )
}
