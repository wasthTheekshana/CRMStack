// frontend/src/store/notificationStore.ts
import { create } from 'zustand';
import {
  fetchNotifications,
  markAllRead,
  dismissNotification,
  Notification,
} from '@/lib/api/notificationsApi';

interface NotificationState {
  notifications: Notification[];
  unreadCount:   number;
  fetchNotifications: () => Promise<void>;
  markAllRead:        () => Promise<void>;
  dismiss:            (id: string) => Promise<void>;
  startPolling:       () => void;
  stopPolling:        () => void;
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount:   0,

  fetchNotifications: async () => {
    try {
      const data = await fetchNotifications();
      set({ notifications: data.notifications, unreadCount: data.unreadCount });
    } catch {
      // silent — polling failures should not disrupt the UI
    }
  },

  markAllRead: async () => {
    await markAllRead();
    set((state) => ({
      unreadCount:   0,
      notifications: state.notifications.map((n) => ({
        ...n,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
    }));
  },

  dismiss: async (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: Math.max(
        0,
        state.unreadCount -
          (state.notifications.find((n) => n.id === id)?.readAt === null ? 1 : 0)
      ),
    }));
    await dismissNotification(id);
  },

  startPolling: () => {
    if (pollingInterval !== null) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    get().fetchNotifications();
    pollingInterval = setInterval(() => {
      get().fetchNotifications();
    }, 30_000);
  },

  stopPolling: () => {
    if (pollingInterval !== null) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },
}));
