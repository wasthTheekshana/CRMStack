import { apiFetch } from './apiClient';
import type { Lead } from '../models';

export const getLeads = () =>
  apiFetch<Lead[]>('/api/leads');

export const getDeletedLeads = () =>
  apiFetch<Lead[]>('/api/leads/deleted');

export const getLeadById = (id: string) =>
  apiFetch<Lead>(`/api/leads/${id}`);

export const createLead = (data: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>) =>
  apiFetch<Lead>('/api/leads', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateLead = (id: string, data: Partial<Lead>) =>
  apiFetch<Lead>(`/api/leads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const reassignLead = (leadId: string, ownerId: string) =>
  apiFetch<Lead>(`/api/leads/${leadId}/owner`, {
    method: 'PATCH',
    body: JSON.stringify({ ownerId }),
  });

export const deleteLead = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/leads/${id}`, { method: 'DELETE' });

export const restoreLead = (id: string) =>
  apiFetch<Lead>(`/api/leads/${id}/restore`, { method: 'PUT' });

export const getLeadCountByUser = async (userId: string): Promise<number> => {
  const leads = await apiFetch<Lead[]>('/api/leads');
  return leads.filter(l => l.ownerId === userId).length;
};

export const reassignLeads = async (
  fromUserId: string,
  toUserId: string,
  toUserEmail: string
): Promise<number> => {
  const leads = await apiFetch<Lead[]>('/api/leads');
  const toReassign = leads.filter(l => l.ownerId === fromUserId);
  await Promise.all(
    toReassign.map(l =>
      apiFetch(`/api/leads/${l.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ownerId: toUserId, ownerEmail: toUserEmail }),
      })
    )
  );
  return toReassign.length;
};
