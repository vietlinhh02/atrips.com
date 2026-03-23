/**
 * Gamification Routes
 * Defines routes for badges, points, and leaderboard endpoints
 */

import { Router } from 'express';
import gamificationController from './gamificationController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// Badges
router.get('/badges', gamificationController.listBadges);
router.get('/my/badges', gamificationController.getMyBadges);

// Points
router.get('/my/points', gamificationController.getMyPoints);
router.get(
  '/my/points/history',
  gamificationController.getMyPointsHistory
);
router.post('/points', gamificationController.awardPoints);

// Leaderboard
router.get('/leaderboard', gamificationController.getLeaderboard);
router.post(
  '/leaderboard/refresh',
  gamificationController.refreshLeaderboard
);

export default router;
