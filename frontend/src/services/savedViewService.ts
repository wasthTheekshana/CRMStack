import { apiFetch } from './apiClient'

export interface SavedView {
  id:        string
  name:      string
  filters:   Record<string, unknown>
  createdAt: string
}

export const getSavedViews = () =>
  apiFetch<SavedView[]>('/api/saved-views')

export const createSavedView = (name: string, filters: Record<string, unknown>) =>
  apiFetch<SavedView>('/api/saved-views', {
    method: 'POST',
    body: JSON.stringify({ name, filters }),
  })

export const deleteSavedView = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/saved-views/${id}`, { method: 'DELETE' })
