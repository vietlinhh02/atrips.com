/**
 * Notification Routes
 * Defines routes for notification endpoints
 */

import { Router } from 'express';
import notificationController from './notificationController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// Notification list and counts
router.get('/', notificationController.listNotifications);
router.get('/unread-count', notificationController.getUnreadCount);

// Bulk operations (must be before /:id routes)
router.patch('/read-all', notificationController.markAllAsRead);

// Single notification operations
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

// Preferences
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreferences);

export default router;
