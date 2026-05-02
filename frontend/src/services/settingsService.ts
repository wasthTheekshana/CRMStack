import { apiFetch } from './apiClient';
import type { DashboardSettings } from '../models';

export const getDashboardSettings = (userId: string) =>
  apiFetch<DashboardSettings>(`/api/settings/${userId}`);

export const saveDashboardSettings = (userId: string, settings: Partial<DashboardSettings>) =>
  apiFetch<DashboardSettings>(`/api/settings/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
