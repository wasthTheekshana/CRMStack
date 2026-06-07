import { apiFetch } from './apiClient'
import type { ContactRecord } from '../models'

export const getContactsByCompany = (companyId: string) =>
  apiFetch<ContactRecord[]>(`/api/contacts?companyId=${encodeURIComponent(companyId)}`)

export const getAllContacts = () =>
  apiFetch<ContactRecord[]>('/api/contacts')

export const createContact = (data: {
  companyId?: string; name: string; phone?: string; email?: string; designation?: string
}) => apiFetch<ContactRecord>('/api/contacts', { method: 'POST', body: JSON.stringify(data) })

export const updateContact = (id: string, data: Partial<{
  name: string; phone: string | null; email: string | null; designation: string | null
}>) => apiFetch<ContactRecord>(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteContact = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/contacts/${id}`, { method: 'DELETE' })
