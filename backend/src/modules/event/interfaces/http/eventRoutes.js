/**
 * Event Routes
 * Defines routes for local event endpoints
 */

import { Router } from 'express';
import eventController from './eventController.js';
import {
  authenticate,
  optionalAuth,
} from '../../../../shared/middleware/authenticate.js';

const router = Router();

router.get('/search', optionalAuth, eventController.searchEvents);
router.get('/nearby', optionalAuth, eventController.searchNearby);
router.get(
  '/trips/:tripId/events',
  authenticate,
  eventController.getTripEvents,
);
router.get('/:id', optionalAuth, eventController.getEventById);

export default router;
