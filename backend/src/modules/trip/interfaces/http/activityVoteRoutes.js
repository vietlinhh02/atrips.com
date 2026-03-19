/**
 * Activity Vote Routes
 * Defines routes for activity voting endpoints
 */

import { Router } from 'express';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import * as activityVoteController from './activityVoteController.js';

const router = Router();

router.use(authenticate);

// Vote summaries
router.get(
  '/activities/:activityId/votes',
  activityVoteController.getVoteSummary,
);
router.get(
  '/trips/:tripId/votes',
  activityVoteController.getTripVoteSummaries,
);

// Cast and remove votes
router.post(
  '/activities/:activityId/votes',
  activityVoteController.castVote,
);
router.delete(
  '/activities/:activityId/votes',
  activityVoteController.removeVote,
);

export default router;
