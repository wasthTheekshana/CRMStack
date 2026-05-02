import { apiFetch } from './apiClient';
import type { Task } from '../models';

export const getTasks = () =>
  apiFetch<Task[]>('/api/tasks');

export const getUpcomingTasks = async () => {
  const tasks = await apiFetch<Task[]>('/api/tasks');
  const now = new Date();
  return tasks
    .filter(t => t.status === 'pending' && new Date(t.dueDate as string) >= now)
    .slice(0, 5);
};

export const createTask = (data: Omit<Task, 'id' | 'createdAt'>) =>
  apiFetch<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateTask = (id: string, data: Partial<Task>) =>
  apiFetch<Task>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const completeTask = (id: string) =>
  apiFetch<Task>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'completed' }),
  });

export const deleteTask = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' });
