/**
 * Follow Routes
 * Defines routes for user-follows-user endpoints
 */

import { Router } from 'express';
import followController from './followController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';

const router = Router();

// Public — anyone can list followers / following
router.get('/users/:userId/followers', followController.getFollowers);
router.get('/users/:userId/following', followController.getFollowing);

// Authenticated — follow, unfollow, check status
router.post(
  '/users/:userId/follow',
  authenticate,
  followController.followUser
);
router.delete(
  '/users/:userId/follow',
  authenticate,
  followController.unfollowUser
);
router.get(
  '/users/:userId/follow-status',
  authenticate,
  followController.getFollowStatus
);

export default router;
