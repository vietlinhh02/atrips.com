/**
 * Cache Management Routes
 * Admin endpoints for cache management
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { authenticate } from '../../middleware/authenticate.js';
import cacheService from '../../services/CacheService.js';

const router = Router();

/**
 * @route GET /api/cache/stats
 * @desc Get cache statistics
 * @access Private
 */
router.get('/stats', authenticate, asyncHandler(async (req, res) => {
  const stats = await cacheService.getStats();

  return sendSuccess(res, {
    cache: stats,
    timestamp: new Date().toISOString(),
  });
}));

/**
 * @route DELETE /api/cache/clear
 * @desc Clear all cache
 * @access Private (should be admin only in production)
 */
router.delete('/clear', authenticate, asyncHandler(async (req, res) => {
  const { pattern } = req.query;

  if (pattern) {
    // Clear specific pattern
    await cacheService.delPattern(pattern);
    return sendSuccess(res, null, `Cache cleared for pattern: ${pattern}`);
  }

  // Clear all cache
  await cacheService.delPattern('*');

  return sendSuccess(res, null, 'All cache cleared successfully');
}));

/**
 * @route DELETE /api/cache/user/:userId
 * @desc Clear cache for specific user
 * @access Private
 */
router.delete('/user/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Clear all user-related caches
  const patterns = [
    `user:*:${userId}`,
    `travel_profile:${userId}`,
    `onboarding:status:${userId}`,
    `chats:*:${userId}:*`,
    `ai:conversations:*:${userId}:*`,
    `ai:quota:${userId}`,
  ];

  await Promise.all(patterns.map(p => cacheService.delPattern(p)));

  return sendSuccess(res, null, `Cache cleared for user: ${userId}`);
}));

/**
 * @route GET /api/cache/key/:key
 * @desc Get specific cache key value (for debugging)
 * @access Private
 */
router.get('/key/:key', authenticate, asyncHandler(async (req, res) => {
  const { key } = req.params;
  const value = await cacheService.get(key);

  return sendSuccess(res, {
    key,
    exists: value !== null,
    value: value,
  });
}));

export default router;
