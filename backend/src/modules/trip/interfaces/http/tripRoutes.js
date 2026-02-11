/**
 * Trip Routes
 * Defines routes for trip endpoints
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as tripController from './tripController.js';
import { authenticate } from '../../../../shared/middleware/authenticate.js';
import tripPhase1Routes from './tripPhase1Routes.js';

const router = Router();

router.use(authenticate);

// ═══════════════════════════════════════════════════════════════
// Phase 1 Routes (Overview, Transportation, Bookings, Budget)
// ═══════════════════════════════════════════════════════════════
router.use('/', tripPhase1Routes);

const createTripValidation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be 2000 characters or less'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('travelersCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Travelers count must be at least 1'),
  body('budgetTotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget total must be a positive number'),
  body('budgetCurrency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Budget currency must be a 3-character ISO 4217 code'),
  body('coverImageUrl')
    .optional()
    .isURL()
    .withMessage('Cover image URL must be a valid URL'),
];

const updateTripValidation = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be 2000 characters or less'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  body('travelersCount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Travelers count must be at least 1'),
  body('budgetTotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Budget total must be a positive number'),
  body('budgetCurrency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Budget currency must be a 3-character ISO 4217 code'),
  body('status')
    .optional()
    .isIn(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'])
    .withMessage('Status must be one of: DRAFT, ACTIVE, COMPLETED, ARCHIVED'),
  body('visibility')
    .optional()
    .isIn(['PRIVATE', 'SHARED', 'PUBLIC'])
    .withMessage('Visibility must be one of: PRIVATE, SHARED, PUBLIC'),
  body('coverImageUrl')
    .optional()
    .isURL()
    .withMessage('Cover image URL must be a valid URL'),
];

const applyDraftValidation = [
  body('createNew')
    .optional()
    .isBoolean()
    .withMessage('createNew must be a boolean'),
  body('existingTripId')
    .optional()
    .isString()
    .withMessage('existingTripId must be a string'),
];

const modifyTripValidation = [
  body('message')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  body('conversationId')
    .optional()
    .isString()
    .withMessage('conversationId must be a string'),
];

const addActivityValidation = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Name must be between 1 and 200 characters'),
  body('type')
    .optional()
    .isIn(['ATTRACTION', 'DINING', 'ACCOMMODATION', 'TRANSPORTATION', 'ACTIVITY', 'SHOPPING', 'OTHER'])
    .withMessage('Invalid activity type'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be 2000 characters or less'),
  body('startTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
    .withMessage('Start time must be in HH:mm or HH:mm:ss format'),
  body('endTime')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)
    .withMessage('End time must be in HH:mm or HH:mm:ss format'),
  body('duration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Duration must be a positive integer'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('estimatedCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated cost must be a positive number'),
];

const reorderActivitiesValidation = [
  body('activityIds')
    .isArray({ min: 1 })
    .withMessage('activityIds must be a non-empty array'),
  body('activityIds.*')
    .isString()
    .withMessage('Each activity ID must be a string'),
];

// ═══════════════════════════════════════════════════════════════
// DIRECT TRIP CREATION DISABLED
// This endpoint will throw an error directing users to use AI
// ═══════════════════════════════════════════════════════════════
router.post('/', createTripValidation, tripController.createTrip);

// Trip management endpoints
router.get('/', tripController.listTrips);
router.get('/:id', tripController.getTrip);
router.patch('/:id', updateTripValidation, tripController.updateTrip);
router.delete('/:id', tripController.deleteTrip);

// ═══════════════════════════════════════════════════════════════
// AI-POWERED TRIP CREATION (REQUIRED METHOD)
// ═══════════════════════════════════════════════════════════════
router.post('/drafts/:draftId/apply', applyDraftValidation, tripController.applyAIDraft);
router.post('/:tripId/ai-modify', modifyTripValidation, tripController.modifyTripWithAI);

router.post('/:tripId/days/:dayId/activities', addActivityValidation, tripController.addActivity);
router.patch('/:tripId/activities/:activityId', addActivityValidation, tripController.updateActivity);
router.delete('/:tripId/activities/:activityId', tripController.deleteActivity);
router.patch('/:tripId/days/:dayId/activities/reorder', reorderActivitiesValidation, tripController.reorderActivities);

export default router;
