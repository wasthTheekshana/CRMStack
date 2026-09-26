export type RelativePeriod = 'last_week' | 'last_month' | 'last_two_months'

/**
 * Subtracts `months` from `date` without JS's Date.setMonth() day-overflow —
 * e.g. Oct 31 minus 1 month naively overflows to Oct 1 (Sep has only 30 days)
 * instead of Sep 30, silently shrinking the window. Clamps to the last valid
 * day of the target month instead.
 */
function subtractMonths(date: Date, months: number): Date {
  const day = date.getDate()
  const result = new Date(date)
  result.setDate(1)
  result.setMonth(result.getMonth() - months)
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(day, daysInTargetMonth))
  return result
}

/** Start-of-window date for a relative period, counting back from now. */
export function periodStartDate(period: RelativePeriod): Date {
  const now = new Date()
  if (period === 'last_week') {
    now.setDate(now.getDate() - 7)
    return now
  }
  return subtractMonths(now, period === 'last_month' ? 1 : 2)
}

/**
 * True if createdAt is a valid date on or after `start`.
 * Missing or unparseable dates never match — Invalid Date comparisons in JS are
 * always false, which would otherwise make a bad date fall inside every window.
 */
export function isOnOrAfter(createdAt: string | undefined, start: Date): boolean {
  if (!createdAt) return false
  const ms = new Date(createdAt).getTime()
  if (isNaN(ms)) return false
  return ms >= start.getTime()
}
