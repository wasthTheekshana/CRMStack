import { SalesStage } from '@/types'

// Sales stage configuration with colors, order, and default probability
export const SALES_STAGES: { id: SalesStage; label: string; color: string; order: number; probability: number }[] = [
  { id: 'On Hold', label: 'On Hold', color: '#F97316', order: 0, probability: 10 },
  { id: 'Meeting Pending', label: 'Meeting Pending', color: '#3B82F6', order: 1, probability: 25 },
  { id: 'Proposal Sent', label: 'Proposal Sent', color: '#8B5CF6', order: 2, probability: 50 },
  { id: 'Negotiated', label: 'Negotiated', color: '#A855F7', order: 3, probability: 75 },
  { id: 'Verbal Yes', label: 'Verbal Yes', color: '#EC4899', order: 4, probability: 90 },
  { id: 'Closed & Won', label: 'Closed & Won', color: '#22C55E', order: 5, probability: 100 },
]

// Get default probability for a stage
export function getDefaultProbability(stage: SalesStage): number {
  return SALES_STAGES.find(s => s.id === stage)?.probability || 25
}

// Solution types (can be customized)
export const SOLUTIONS = [
  'Document Management',
  'Workflow Automation',
  'Digital Archiving',
  'Records Management',
  'Business Process Management',
  'Other',
]

// Probability buckets for analysis
export const PROBABILITY_BUCKETS = [10, 25, 50, 75, 90, 100]

// Task types
export const TASK_TYPES = [
  { value: 'call', label: 'Phone Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'follow-up', label: 'Follow Up' },
  { value: 'other', label: 'Other' },
]

// Task priorities
export const TASK_PRIORITIES = [
  { value: 'low', label: 'Low', color: '#22C55E' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' },
]

// Chart colors
export const CHART_COLORS = [
  '#3B82F6', // Blue
  '#22C55E', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
]

// Currency format
export const CURRENCY = 'LKR'
export const CURRENCY_LOCALE = 'en-LK'

// Format number as currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format number with commas
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE).format(value)
}

// Get risk level based on probability
export function getRiskLevel(probability: number): { level: 'high' | 'medium' | 'low'; color: string } {
  if (probability < 30) {
    return { level: 'high', color: '#EF4444' }
  } else if (probability < 60) {
    return { level: 'medium', color: '#F59E0B' }
  } else {
    return { level: 'low', color: '#22C55E' }
  }
}

// Get stage color
export function getStageColor(stage: SalesStage): string {
  return SALES_STAGES.find(s => s.id === stage)?.color || '#6B7280'
}
