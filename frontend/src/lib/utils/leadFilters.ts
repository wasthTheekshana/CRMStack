import type { CustomFieldConfig } from '@/services/tenantService'
import type { Lead } from '@/types'

/** An inclusive date range. An empty string means "no limit" on that side. */
export interface DateRange {
  from: string
  to: string
}

export const EMPTY_DATE_RANGE: DateRange = { from: '', to: '' }

export function isDateRangeActive(range: DateRange): boolean {
  return range.from !== '' || range.to !== ''
}

/** Custom field ids are generated per workspace, so fields are found by name. */
export function findCustomFieldByName(
  cfConfigs: CustomFieldConfig[],
  name: string,
  type: CustomFieldConfig['type']
): CustomFieldConfig | undefined {
  const wanted = name.trim().toLowerCase()
  return cfConfigs.find((f) => f.type === type && f.name.trim().toLowerCase() === wanted)
}

// Date fields hold "YYYY-MM-DD" (date input / import) or an ISO timestamp. Only the
// date part matters, and ISO dates compare correctly as plain strings.
const ISO_DATE = /^(\d{4}-\d{2}-\d{2})/

/**
 * True if the lead's date field falls inside the range (inclusive on both ends).
 * With no range set everything matches. With a range set, a lead that has no valid
 * date in the field does not match.
 */
export function isLeadDateInRange(lead: Lead, field: CustomFieldConfig | undefined, range: DateRange): boolean {
  if (!isDateRangeActive(range)) return true
  if (!field) return true
  const match = ISO_DATE.exec(String(lead.customFields?.[field.id] ?? ''))
  if (!match) return false
  const day = match[1]
  if (range.from && day < range.from) return false
  if (range.to && day > range.to) return false
  return true
}

export interface NumberFieldSum {
  total: number
  /** How many of the leads actually have a numeric value in the field. */
  leadsWithValue: number
}

/** Sum of a number custom field. Blank and non-numeric values are skipped. */
export function sumNumberField(leads: Lead[], field: CustomFieldConfig | undefined): NumberFieldSum {
  let total = 0
  let leadsWithValue = 0
  if (!field) return { total, leadsWithValue }
  for (const lead of leads) {
    const raw = lead.customFields?.[field.id]
    if (raw === undefined || raw === null || raw === '') continue
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
    if (!Number.isFinite(n)) continue
    total += n
    leadsWithValue += 1
  }
  return { total, leadsWithValue }
}
