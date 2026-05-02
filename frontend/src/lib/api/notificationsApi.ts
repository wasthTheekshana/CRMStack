// frontend/src/lib/api/notificationsApi.ts
import { apiFetch } from '@/config/api';

export interface Notification {
  id:        string;
  type:      string;
  title:     string;
  body:      string;
  link:      string | null;
  readAt:    string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  unreadCount:   number;
  notifications: Notification[];
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  return apiFetch<NotificationsResponse>('/api/notifications');
}

export async function markAllRead(): Promise<void> {
  await apiFetch('/api/notifications/mark-all-read', { method: 'POST' });
}

export async function dismissNotification(id: string): Promise<void> {
  await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
}
