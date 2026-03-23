import { create } from 'zustand';

import notificationService from '@/src/services/notificationService';
import type {
  Notification,
  Pagination,
} from '@/src/services/notificationService';

interface NotificationParams {
  page?: number;
  limit?: number;
  type?: string;
  isRead?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  pagination: Pagination;

  fetchNotifications: (
    params?: NotificationParams
  ) => Promise<void>;
  fetchMore: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const DEFAULT_PAGINATION: Pagination = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasMore: false,
};

const useNotificationStore = create<NotificationState>()(
  (set, get) => ({
    notifications: [],
    unreadCount: 0,
    loading: false,
    pagination: DEFAULT_PAGINATION,

    fetchNotifications: async (params) => {
      set({ loading: true });
      try {
        const result =
          await notificationService.getNotifications(params);
        set({
          notifications: result.notifications,
          pagination: result.pagination,
          loading: false,
        });
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        set({ loading: false });
      }
    },

    fetchMore: async () => {
      const { pagination, notifications, loading } = get();
      if (loading || !pagination.hasMore) return;

      set({ loading: true });
      try {
        const result =
          await notificationService.getNotifications({
            page: pagination.page + 1,
            limit: pagination.limit,
          });
        set({
          notifications: [...notifications, ...result.notifications],
          pagination: result.pagination,
          loading: false,
        });
      } catch (error) {
        console.error('Failed to load more notifications:', error);
        set({ loading: false });
      }
    },

    fetchUnreadCount: async () => {
      try {
        const count =
          await notificationService.getUnreadCount();
        set({ unreadCount: count });
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    },

    markAsRead: async (id) => {
      try {
        await notificationService.markAsRead(id);
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id
              ? { ...n, isRead: true, readAt: new Date().toISOString() }
              : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    },

    markAllAsRead: async () => {
      try {
        await notificationService.markAllAsRead();
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            isRead: true,
            readAt: n.readAt ?? new Date().toISOString(),
          })),
          unreadCount: 0,
        }));
      } catch (error) {
        console.error(
          'Failed to mark all notifications as read:',
          error
        );
      }
    },

    deleteNotification: async (id) => {
      const { notifications } = get();
      const target = notifications.find((n) => n.id === id);
      const wasUnread = target && !target.isRead;

      try {
        await notificationService.deleteNotification(id);
        set((state) => ({
          notifications: state.notifications.filter(
            (n) => n.id !== id
          ),
          pagination: {
            ...state.pagination,
            total: Math.max(0, state.pagination.total - 1),
          },
          unreadCount: wasUnread
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        }));
      } catch (error) {
        console.error('Failed to delete notification:', error);
      }
    },
  })
);

export default useNotificationStore;
