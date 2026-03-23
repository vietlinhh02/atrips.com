/**
 * Notification Controller
 * Handles HTTP requests for notification endpoints
 */

import { sendSuccess, sendPaginated } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import notificationRepository from '../../infrastructure/repositories/NotificationRepository.js';

/**
 * @route GET /api/notifications
 * @desc List notifications (paginated, filterable by type/isRead)
 * @access Private
 */
export const listNotifications = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const { type } = req.query;

  let isRead;
  if (req.query.isRead === 'true') {
    isRead = true;
  } else if (req.query.isRead === 'false') {
    isRead = false;
  }

  const result = await notificationRepository.findByUserId(
    req.user.id,
    { page, limit, type, isRead },
  );

  return sendPaginated(
    res,
    result.notifications,
    { page: result.page, limit: result.limit, total: result.total },
  );
});

/**
 * @route GET /api/notifications/unread-count
 * @desc Get unread notification count
 * @access Private
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const result = await notificationRepository.countUnread(req.user.id);

  return sendSuccess(res, result);
});

/**
 * @route PATCH /api/notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const notification = await notificationRepository.markAsRead(id, req.user.id);

  return sendSuccess(res, { notification }, 'Notification marked as read');
});

/**
 * @route PATCH /api/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
export const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationRepository.markAllAsRead(req.user.id);

  return sendSuccess(res, result, 'All notifications marked as read');
});

/**
 * @route DELETE /api/notifications/:id
 * @desc Delete a notification
 * @access Private
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await notificationRepository.deleteNotification(id, req.user.id);

  return sendSuccess(res, null, 'Notification deleted successfully');
});

/**
 * @route GET /api/notifications/preferences
 * @desc Get notification preferences
 * @access Private
 */
export const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await notificationRepository.getPreferences(req.user.id);

  return sendSuccess(res, { preferences });
});

/**
 * @route PUT /api/notifications/preferences
 * @desc Update notification preferences
 * @access Private
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const { preferences } = req.body;

  if (!Array.isArray(preferences) || preferences.length === 0) {
    throw AppError.badRequest('preferences must be a non-empty array');
  }

  const results = await Promise.all(
    preferences.map(({ channel, eventType, enabled }) => {
      if (!channel || !eventType || typeof enabled !== 'boolean') {
        throw AppError.badRequest(
          'Each preference must have channel, eventType, and enabled (boolean)',
        );
      }
      return notificationRepository.upsertPreference(
        req.user.id,
        channel,
        eventType,
        enabled,
      );
    }),
  );

  return sendSuccess(res, { preferences: results }, 'Preferences updated successfully');
});

export default {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getPreferences,
  updatePreferences,
};
