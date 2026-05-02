import { apiFetch } from './apiClient';
import type { SalesTarget } from '../models';

export const getSalesTargets = () =>
  apiFetch<SalesTarget[]>('/api/sales-targets');

export const getSalesTargetByMonth = async (year: number, month: number, ownerId: string) => {
  const all = await apiFetch<SalesTarget[]>('/api/sales-targets');
  return all.find(t => t.year === year && t.month === month && t.ownerId === ownerId) || null;
};

export const createSalesTarget = (data: Omit<SalesTarget, 'id' | 'createdAt' | 'updatedAt'>) =>
  apiFetch<SalesTarget>('/api/sales-targets', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateSalesTarget = (id: string, data: Partial<SalesTarget>) =>
  apiFetch<SalesTarget>(`/api/sales-targets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteSalesTarget = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/sales-targets/${id}`, { method: 'DELETE' });

export const getAllSalesTargetsByYear = async (year: number): Promise<SalesTarget[]> => {
  const all = await apiFetch<SalesTarget[]>('/api/sales-targets');
  return all.filter(t => t.year === year);
};
