/**
 * Notification Repository
 * Database operations for notifications and notification preferences
 */

import prisma from '../../../../config/database.js';
import { AppError } from '../../../../shared/errors/AppError.js';

class NotificationRepository {
  /**
   * Find notifications by user ID with pagination and filters
   */
  async findByUserId(userId, { page = 1, limit = 20, type, isRead }) {
    const skip = (page - 1) * limit;

    const where = { userId };
    if (type) {
      where.type = type;
    }
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [notifications, total] = await Promise.all([
      prisma.notifications.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notifications.count({ where }),
    ]);

    return { notifications, total, page, limit };
  }

  /**
   * Count unread notifications for a user
   */
  async countUnread(userId) {
    const count = await prisma.notifications.count({
      where: { userId, isRead: false },
    });

    return { count };
  }

  /**
   * Mark a single notification as read (verify ownership)
   */
  async markAsRead(id, userId) {
    const notification = await prisma.notifications.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw AppError.notFound('Notification not found');
    }

    return prisma.notifications.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    const result = await prisma.notifications.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return { updated: result.count };
  }

  /**
   * Delete a single notification (verify ownership)
   */
  async deleteNotification(id, userId) {
    const notification = await prisma.notifications.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      throw AppError.notFound('Notification not found');
    }

    return prisma.notifications.delete({ where: { id } });
  }

  /**
   * Create a notification
   */
  async create({ userId, type, title, body, entityType, entityId, channels }) {
    return prisma.notifications.create({
      data: {
        userId,
        type,
        title,
        body,
        entityType: entityType || null,
        entityId: entityId || null,
        channels: channels || ['IN_APP'],
      },
    });
  }

  /**
   * Get all notification preferences for a user
   */
  async getPreferences(userId) {
    return prisma.notification_preferences.findMany({
      where: { userId },
      orderBy: [{ channel: 'asc' }, { eventType: 'asc' }],
    });
  }

  /**
   * Upsert a single notification preference
   */
  async upsertPreference(userId, channel, eventType, enabled) {
    return prisma.notification_preferences.upsert({
      where: {
        userId_channel_eventType: { userId, channel, eventType },
      },
      create: { userId, channel, eventType, enabled },
      update: { enabled },
    });
  }
}

export default new NotificationRepository();
