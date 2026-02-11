/**
 * Profile Routes
 * Defines routes for travel profile endpoints
 */

import { Router } from 'express';
import profileController from './profileController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Travel profile routes
router.get('/travel/needs-onboarding', profileController.checkOnboarding);
router.get('/travel', profileController.getTravelProfile);
router.patch('/travel', profileController.updateTravelProfile);
router.post('/travel/complete', profileController.completeOnboarding);

export default router;
