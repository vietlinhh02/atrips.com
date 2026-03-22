import { Router } from 'express';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import * as tripShareController from './tripShareController.js';

const router = Router();

// Public routes (no auth)
router.get('/shared/:shareToken', tripShareController.getSharedTrip);

// Authenticated routes
router.post(
  '/:tripId/share',
  authenticate,
  tripShareController.shareTrip
);
router.delete(
  '/:tripId/share',
  authenticate,
  tripShareController.revokeShare
);
router.post(
  '/shared/:shareToken/duplicate',
  authenticate,
  tripShareController.duplicateSharedTrip
);

export default router;
