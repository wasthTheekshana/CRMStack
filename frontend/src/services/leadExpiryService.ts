import { apiFetch } from './apiClient'

export interface LeadExpiry {
  id:         string
  leadId:     string
  expiryDate: string   // "YYYY-MM-DD"
  setBy:      string
  createdAt:  string
  updatedAt:  string
}

export type ExpiryMap = Record<string, { expiryDate: string; daysUntil: number }>

export const getLeadExpiry = (leadId: string) =>
  apiFetch<LeadExpiry | null>(`/api/leads/${leadId}/expiry`)

export const getBulkLeadExpiry = () =>
  apiFetch<ExpiryMap>(`/api/leads/expiry/bulk`)

export const setLeadExpiry = (leadId: string, expiryDate: string) =>
  apiFetch<LeadExpiry>(`/api/leads/${leadId}/expiry`, {
    method: 'PUT',
    body: JSON.stringify({ expiryDate }),
  })

export const deleteLeadExpiry = (leadId: string) =>
  apiFetch<void>(`/api/leads/${leadId}/expiry`, { method: 'DELETE' })
