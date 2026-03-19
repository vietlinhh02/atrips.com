/**
 * Weather Routes
 * Defines routes for weather forecast endpoints
 */

import { Router } from 'express';
import weatherController from './weatherController.js';
import {
  authenticate,
  optionalAuth,
} from '../../../../shared/middleware/authenticate.js';

const router = Router();

router.get('/forecast', optionalAuth, weatherController.getForecast);

router.get(
  '/trips/:tripId/weather',
  authenticate,
  weatherController.getTripWeather,
);

export default router;
