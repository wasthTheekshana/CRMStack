import { apiFetch } from './apiClient';
import type { Activity } from '../models';

export interface ActivityFilters {
  ownerId?:   string;
  type?:      string;
  leadId?:    string;
  startDate?: string;
  endDate?:   string;
  limit?:     number;
}

export const getActivities = (filters: ActivityFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.ownerId)        params.set('ownerId', filters.ownerId);
  if (filters.type)           params.set('type', filters.type);
  if (filters.leadId)         params.set('leadId', filters.leadId);
  if (filters.startDate)      params.set('startDate', filters.startDate);
  if (filters.endDate)        params.set('endDate', filters.endDate);
  if (filters.limit != null)  params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiFetch<Activity[]>(`/api/activities${qs ? `?${qs}` : ''}`);
};

export const getActivitiesByLead = (leadId: string) =>
  apiFetch<Activity[]>(`/api/activities/lead/${leadId}`);

export const createActivity = (data: Omit<Activity, 'id' | 'createdAt'>) =>
  apiFetch<Activity>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateActivity = (id: string, data: { type?: string; description?: string }) =>
  apiFetch<Activity>(`/api/activities/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
