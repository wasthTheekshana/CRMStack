import { format, formatDistanceToNow, isToday, isYesterday, isTomorrow } from 'date-fns'

// Format currency (LKR)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format large numbers with K, M suffixes
export function formatCompactNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toString()
}

// Format currency in compact form (LKR with K, M suffixes)
export function formatCompactCurrency(value: number): string {
  if (value >= 1000000) {
    return `Rs.${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `Rs.${(value / 1000).toFixed(0)}K`
  }
  return `Rs.${value}`
}

// Format percentage
export function formatPercentage(value: number): string {
  return `${value.toFixed(0)}%`
}

// Format number with commas
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-LK').format(value)
}

// Convert ISO string or Date to Date object (PostgreSQL returns ISO strings)
export function timestampToDate(timestamp: string | Date | undefined): Date {
  if (!timestamp) return new Date()
  if (timestamp instanceof Date) return timestamp
  return new Date(timestamp)
}

// Format date for display
export function formatDate(date: Date | string | undefined): string {
  if (!date) return '-'
  const d = timestampToDate(date)

  if (isToday(d)) {
    return `Today, ${format(d, 'h:mm a')}`
  }
  if (isYesterday(d)) {
    return `Yesterday, ${format(d, 'h:mm a')}`
  }
  if (isTomorrow(d)) {
    return `Tomorrow, ${format(d, 'h:mm a')}`
  }

  return format(d, 'MMM d, yyyy')
}

// Format date with time
export function formatDateTime(date: Date | string | undefined): string {
  if (!date) return '-'
  const d = timestampToDate(date)
  return format(d, 'MMM d, yyyy h:mm a')
}

// Format relative time
export function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return '-'
  const d = timestampToDate(date)
  return formatDistanceToNow(d, { addSuffix: true })
}

// Format date for input fields
export function formatDateForInput(date: Date | string | undefined): string {
  if (!date) return ''
  const d = timestampToDate(date)
  return format(d, 'yyyy-MM-dd')
}

// Calculate percentage change
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// Format delta percentage with + or - sign
export function formatDeltaPercentage(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}
