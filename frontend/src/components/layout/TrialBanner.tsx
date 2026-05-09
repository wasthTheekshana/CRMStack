import { Clock, AlertTriangle } from 'lucide-react'
import { useTrialEndsAt } from '@/store/authStore'

function daysUntil(isoDate: string): number {
  const expiry = new Date(isoDate)
  expiry.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000)
}

export function TrialBanner() {
  const trialEndsAt = useTrialEndsAt()
if (!trialEndsAt) return null

  const days = daysUntil(trialEndsAt)
  if (days < 0) return null // already expired / suspended — backend handles this

  const isUrgent = days <= 2
  const isWarning = days <= 5

  const bgColor = isUrgent
    ? 'bg-red-50 border-red-200 text-red-800'
    : isWarning
    ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
    : 'bg-blue-50 border-blue-200 text-blue-800'

  const label =
    days === 0
      ? 'Your free trial expires today!'
      : `Free Trial — ${days} day${days === 1 ? '' : 's'} remaining`

  return (
    <div className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium border-b ${bgColor}`}>
      {isUrgent ? (
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Clock className="h-4 w-4 flex-shrink-0" />
      )}
      <span>{label}</span>
      <span className="text-xs opacity-70">· Contact support to upgrade</span>
    </div>
  )
}
