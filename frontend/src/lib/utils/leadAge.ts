export function getLeadAgeDays(createdAt: string | undefined): number {
  if (!createdAt) return -1
  const ms = new Date(createdAt).getTime()
  if (isNaN(ms)) return -1
  const diffMs = Date.now() - ms
  if (diffMs < 0) return -1  // future-dated record
  return Math.floor(diffMs / 86_400_000)
}

export function formatLeadAge(createdAt: string | undefined): string {
  const days = getLeadAgeDays(createdAt)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`

  const months = Math.floor(days / 30)
  const remDays = days % 30

  if (months < 12) {
    if (remDays === 0) return `${months} month${months > 1 ? 's' : ''}`
    return `${months} month${months > 1 ? 's' : ''} ${remDays}d`
  }

  const years = Math.floor(months / 12)
  const remMonths = months % 12
  if (remMonths === 0) return `${years} year${years > 1 ? 's' : ''}`
  return `${years} year${years > 1 ? 's' : ''} ${remMonths} month${remMonths > 1 ? 's' : ''}`
}
