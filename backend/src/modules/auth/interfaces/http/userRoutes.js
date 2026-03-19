/**
 * User Routes
 * Defines routes for user profile endpoints
 */

import { Router } from 'express';
import { body } from 'express-validator';
import userController from './userController.js';
import {
  authenticate,
  optionalAuth,
} from '../../../../shared/middleware/authenticate.js';

const router = Router();

/**
 * Validation rules
 */
const updateProfileValidation = [
  body('name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Name must be 100 characters or less')
    .trim(),
  body('displayName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Display name must be 50 characters or less')
    .trim(),
  body('avatarUrl')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      try {
        const url = new URL(value);
        // Validate protocol
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('Avatar URL must use HTTP or HTTPS protocol');
        }
        return true;
      } catch (error) {
        throw new Error(error.message || 'Invalid avatar URL');
      }
    }),
  body('coverImageUrl')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error(
            'Cover image URL must use HTTP or HTTPS protocol'
          );
        }
        return true;
      } catch (error) {
        throw new Error(error.message || 'Invalid cover image URL');
      }
    }),
  body('coverImageOffsetY')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Cover image offset must be between 0 and 100'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be 500 characters or less')
    .trim(),
];

const updatePreferencesValidation = [
  body('language')
    .optional()
    .isIn(['en', 'vi', 'es', 'fr', 'de', 'ja', 'ko', 'zh'])
    .withMessage('Invalid language code'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'VND', 'JPY', 'KRW', 'CNY', 'THB'])
    .withMessage('Invalid currency code'),
  body('timezone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Invalid timezone'),
  body('travelStyle')
    .optional()
    .isArray()
    .withMessage('Travel style must be an array'),
  body('budgetRange')
    .optional()
    .isIn(['budget', 'moderate', 'mid-range', 'luxury', 'backpacker', 'comfort', 'premium', null])
    .withMessage('Invalid budget range'),
  body('dietaryRestrictions')
    .optional()
    .isArray()
    .withMessage('Dietary restrictions must be an array'),
  body('accessibilityNeeds')
    .optional()
    .isArray()
    .withMessage('Accessibility needs must be an array'),
  body('emailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be a boolean'),
  body('pushNotifications')
    .optional()
    .isBoolean()
    .withMessage('Push notifications must be a boolean'),
  body('profileVisibility')
    .optional()
    .isIn(['public', 'private', 'friends'])
    .withMessage('Invalid profile visibility'),
];

/**
 * Public routes (no auth required, optionalAuth for
 * detecting if viewer is the profile owner)
 */
router.get('/:userId/public', optionalAuth, userController.getPublicProfile);

/**
 * Authenticated routes
 */
router.use(authenticate);

// Profile routes
router.get('/me', userController.getProfile);
router.patch('/me', updateProfileValidation, userController.updateProfile);

// Alternative profile routes (for frontend compatibility)
router.get('/profile', userController.getProfile);
router.patch('/profile', updateProfileValidation, userController.updateProfile);

// Preferences routes
router.get('/me/preferences', userController.getPreferences);
router.patch('/me/preferences', updatePreferencesValidation, userController.updatePreferences);
router.get('/preferences', userController.getPreferences);
router.patch('/preferences', updatePreferencesValidation, userController.updatePreferences);

// Subscription routes
router.get('/me/subscription', userController.getSubscription);
router.get('/subscription', userController.getSubscriptionAlt);

// Stats routes
router.get('/stats', userController.getUserStats);

export default router;
