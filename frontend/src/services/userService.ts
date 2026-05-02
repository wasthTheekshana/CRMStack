import { apiFetch } from './apiClient';
import type { User } from '../models';

export const getUserById = (id: string) =>
  apiFetch<User>(`/api/users/${id}`);

export const getAllUsers = () =>
  apiFetch<User[]>('/api/users');

export const getSalesUsers = () =>
  apiFetch<User[]>('/api/users/sales');

export const createUserProfile = (data: Partial<User> & { password: string }) =>
  apiFetch<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateUserProfile = (id: string, data: Partial<User> & { password?: string }) =>
  apiFetch<User>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const updateUserStatus = (id: string, isActive: boolean) =>
  apiFetch<User>(`/api/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ isActive }),
  });

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const users = await apiFetch<User[]>('/api/users');
  return users.find(u => u.username?.toLowerCase() === username.toLowerCase()) || null;
};

export const isUsernameAvailable = async (username: string): Promise<boolean> => {
  const users = await apiFetch<User[]>('/api/users');
  return !users.some(u => u.username?.toLowerCase() === username.toLowerCase());
};
