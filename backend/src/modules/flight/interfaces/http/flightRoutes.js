/**
 * Flight Routes
 * Defines routes for flight search and price tracking endpoints
 */

import { Router } from 'express';
import flightController from './flightController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.get('/search', flightController.searchFlights);
router.get('/search/history', flightController.getSearchHistory);

router.post('/trackings', flightController.createTracking);
router.get('/trackings', flightController.getUserTrackings);
router.delete('/trackings/:id', flightController.deleteTracking);
router.patch(
  '/trackings/:id/deactivate',
  flightController.deactivateTracking
);

export default router;
