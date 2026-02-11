/**
 * User Controller
 * Handles HTTP requests for user profile endpoints with caching
 */

import { validationResult } from 'express-validator';
import { sendSuccess, sendValidationError } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import getProfileUseCase from '../../application/useCases/GetProfileUseCase.js';
import updateProfileUseCase from '../../application/useCases/UpdateProfileUseCase.js';
import cacheService from '../../../../shared/services/CacheService.js';
import prisma from '../../../../config/database.js';

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  USER_STATS: 1800,        // 30 minutes
  USER_PREFERENCES: 3600,  // 60 minutes
  USER_SUBSCRIPTION: 1200, // 20 minutes
};

// Cache key helpers
const CACHE_KEYS = {
  USER_STATS: (userId) => `user:stats:${userId}`,
  USER_PREFERENCES: (userId) => `user:preferences:${userId}`,
  USER_SUBSCRIPTION_FULL: (userId) => `user:subscription_full:${userId}`,
};

/**
 * @route GET /api/users/me
 * @desc Get current user profile
 * @access Private
 */
export const getProfile = asyncHandler(async (req, res) => {
  const result = await getProfileUseCase.execute(req.user.id);

  return sendSuccess(res, result, 'Profile retrieved successfully');
});

/**
 * @route PATCH /api/users/me
 * @desc Update current user profile
 * @access Private
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const result = await updateProfileUseCase.execute(req.user.id, req.body);

  // Invalidate user caches
  await invalidateUserCaches(req.user.id);

  return sendSuccess(res, {
    user: result.user,
  }, result.message);
});

/**
 * @route GET /api/users/me/preferences
 * @desc Get current user preferences (cached)
 * @access Private
 */
export const getPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cacheKey = CACHE_KEYS.USER_PREFERENCES(userId);

  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return sendSuccess(res, { preferences: cached, fromCache: true });
  }

  const preferences = await prisma.userPreference.findUnique({
    where: { userId },
  });

  const result = preferences || {
    language: 'en',
    currency: 'USD',
    timezone: 'UTC',
    travelStyle: [],
    budgetRange: null,
    dietaryRestrictions: [],
    accessibilityNeeds: [],
    emailNotifications: true,
    pushNotifications: true,
    profileVisibility: 'public',
  };

  // Cache the result
  await cacheService.set(cacheKey, result, CACHE_TTL.USER_PREFERENCES);

  return sendSuccess(res, { preferences: result });
});

/**
 * @route PATCH /api/users/me/preferences
 * @desc Update current user preferences
 * @access Private
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const result = await updateProfileUseCase.updatePreferences(req.user.id, req.body);

  // Invalidate preference cache
  await cacheService.del(CACHE_KEYS.USER_PREFERENCES(req.user.id));

  return sendSuccess(res, {
    preferences: result.preferences,
  }, result.message);
});

/**
 * @route GET /api/users/me/subscription
 * @desc Get current user subscription status (cached)
 * @access Private
 */
export const getSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION_FULL(userId);

  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return sendSuccess(res, { subscription: cached, fromCache: true }, 'Subscription retrieved successfully');
  }

  const result = await getProfileUseCase.getSubscription(userId);

  // Cache the result
  await cacheService.set(cacheKey, result, CACHE_TTL.USER_SUBSCRIPTION);

  return sendSuccess(res, {
    subscription: result,
  }, 'Subscription retrieved successfully');
});

/**
 * @route GET /api/users/subscription
 * @desc Get current user subscription status (alternative route, cached)
 * @access Private
 */
export const getSubscriptionAlt = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cacheKey = CACHE_KEYS.USER_SUBSCRIPTION_FULL(userId);

  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return sendSuccess(res, { ...cached, fromCache: true }, 'Subscription retrieved successfully');
  }

  const result = await getProfileUseCase.getSubscription(userId);

  // Cache the result
  await cacheService.set(cacheKey, result, CACHE_TTL.USER_SUBSCRIPTION);

  return sendSuccess(res, result, 'Subscription retrieved successfully');
});

/**
 * @route GET /api/users/stats
 * @desc Get current user stats (cached)
 * @access Private
 */
export const getUserStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const cacheKey = CACHE_KEYS.USER_STATS(userId);

  // Try cache first
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    return sendSuccess(res, { ...cached, fromCache: true });
  }

  const [tripsCount, completedTrips, upcomingTrips] = await Promise.all([
    prisma.trips.count({
      where: {
        ownerId: userId,
        deletedAt: null,
      },
    }),
    prisma.trips.count({
      where: {
        ownerId: userId,
        status: 'COMPLETED',
        deletedAt: null,
      },
    }),
    prisma.trips.count({
      where: {
        ownerId: userId,
        status: { in: ['DRAFT', 'ACTIVE'] },
        startDate: { gte: new Date() },
        deletedAt: null,
      },
    }),
  ]);

  const result = {
    tripsCount,
    completedTrips,
    upcomingTrips,
    activeTrips: tripsCount - completedTrips,
  };

  // Cache the result
  await cacheService.set(cacheKey, result, CACHE_TTL.USER_STATS);

  return sendSuccess(res, result);
});

/**
 * Helper to invalidate user caches
 */
async function invalidateUserCaches(userId) {
  await Promise.all([
    cacheService.del(CACHE_KEYS.USER_STATS(userId)),
    cacheService.del(CACHE_KEYS.USER_PREFERENCES(userId)),
    cacheService.del(CACHE_KEYS.USER_SUBSCRIPTION_FULL(userId)),
    cacheService.del(`user:basic:${userId}`),
    cacheService.del(`user:profile:${userId}`),
    cacheService.del(`user:subscription:${userId}`),
  ]);
}

export default {
  getProfile,
  updateProfile,
  getPreferences,
  updatePreferences,
  getSubscription,
  getSubscriptionAlt,
  getUserStats,
};
