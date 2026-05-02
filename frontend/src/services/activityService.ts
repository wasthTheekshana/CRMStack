import { apiFetch } from './apiClient';
import type { Activity } from '../models';

export const getActivities = () =>
  apiFetch<Activity[]>('/api/activities');

export const getActivitiesByLead = (leadId: string) =>
  apiFetch<Activity[]>(`/api/activities/lead/${leadId}`);

export const createActivity = (data: Omit<Activity, 'id' | 'createdAt'>) =>
  apiFetch<Activity>('/api/activities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
