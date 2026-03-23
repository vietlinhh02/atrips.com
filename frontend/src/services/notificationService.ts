import api from '../lib/api';

// ============================================
// Types
// ============================================

export type NotificationType =
  | 'TRIP_UPDATE'
  | 'TRIP_INVITE'
  | 'HIRE_STATUS'
  | 'GUIDE_MESSAGE'
  | 'PAYMENT'
  | 'SYSTEM'
  | 'PROMOTION';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  channels: string[];
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: string;
  eventType: string;
  enabled: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface PaginatedResponse {
  success: boolean;
  data: Notification[];
  pagination: Pagination;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface NotificationParams {
  page?: number;
  limit?: number;
  type?: string;
  isRead?: string;
}

interface PreferenceUpdate {
  channel: string;
  eventType: string;
  enabled: boolean;
}

// ============================================
// Notification Service
// ============================================

class NotificationService {
  async getNotifications(
    params: NotificationParams = {}
  ): Promise<{
    notifications: Notification[];
    pagination: Pagination;
  }> {
    const response = await api.get<PaginatedResponse>(
      '/notifications',
      { params }
    );
    return {
      notifications: response.data.data,
      pagination: response.data.pagination,
    };
  }

  async getUnreadCount(): Promise<number> {
    const response = await api.get<ApiResponse<{ count: number }>>(
      '/notifications/unread-count'
    );
    return response.data.data.count;
  }

  async markAsRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  }

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  }

  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  }

  async getPreferences(): Promise<NotificationPreference[]> {
    const response = await api.get<
      ApiResponse<{ preferences: NotificationPreference[] }>
    >('/notifications/preferences');
    return response.data.data.preferences;
  }

  async updatePreferences(
    preferences: PreferenceUpdate[]
  ): Promise<NotificationPreference[]> {
    const response = await api.put<
      ApiResponse<{ preferences: NotificationPreference[] }>
    >('/notifications/preferences', { preferences });
    return response.data.data.preferences;
  }
}

export const notificationService = new NotificationService();
export default notificationService;
