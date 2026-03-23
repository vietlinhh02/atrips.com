import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  authenticate,
  optionalAuth,
} from '../../../../shared/middleware/authenticate.js';
import * as exploreController from './exploreController.js';

const router = Router();

const enhanceRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?.id ?? req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many enhancement requests',
    },
  },
});

router.get('/', optionalAuth, exploreController.getExplore);
router.get(
  '/search', optionalAuth, exploreController.searchDestinations,
);
router.get(
  '/destinations/:id',
  optionalAuth,
  exploreController.getDestination,
);
router.post(
  '/enhance',
  authenticate,
  enhanceRateLimiter,
  exploreController.enhanceDestinations,
);

export default router;
