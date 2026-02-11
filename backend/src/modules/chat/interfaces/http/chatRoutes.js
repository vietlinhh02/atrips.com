/**
 * Chat Routes
 * Defines routes for chat endpoints
 */

import { Router } from 'express';
import chatController from './chatController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Chat routes
router.get('/recent', chatController.getRecentChats);
router.get('/unread-count', chatController.getUnreadCount);
router.get('/:tripId', chatController.getChatRoom);

export default router;
