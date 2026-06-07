import { apiFetch } from './apiClient'
import type { Company } from '../models'

export const getCompanies = () =>
  apiFetch<Company[]>('/api/companies')

export const getCompany = (id: string) =>
  apiFetch<Company>(`/api/companies/${id}`)

export const createCompany = (data: {
  name: string; website?: string; phone?: string; address?: string; notes?: string
}) => apiFetch<Company>('/api/companies', { method: 'POST', body: JSON.stringify(data) })

export const updateCompany = (id: string, data: Partial<{
  name: string; website: string | null; phone: string | null; address: string | null; notes: string | null
}>) => apiFetch<Company>(`/api/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteCompany = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/companies/${id}`, { method: 'DELETE' })
