/**
 * Gamification Controller
 * Handles HTTP requests for badges, points, and leaderboard endpoints
 */

import {
  sendSuccess,
  sendPaginated,
} from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import gamificationRepository from '../../infrastructure/repositories/GamificationRepository.js';

const VALID_ACTIONS = new Set([
  'TRIP_CREATED',
  'TRIP_COMPLETED',
  'REVIEW_POSTED',
  'PHOTO_UPLOADED',
  'REFERRAL',
  'DAILY_LOGIN',
]);

/**
 * @route GET /api/gamification/badges
 * @desc List all active badges
 * @access Private
 */
export const listBadges = asyncHandler(async (req, res) => {
  const badges = await gamificationRepository.getAllBadges();
  return sendSuccess(res, { badges });
});

/**
 * @route GET /api/gamification/my/badges
 * @desc Get authenticated user's earned badges
 * @access Private
 */
export const getMyBadges = asyncHandler(async (req, res) => {
  const userBadges = await gamificationRepository.getUserBadges(
    req.user.id
  );
  return sendSuccess(res, { userBadges });
});

/**
 * @route GET /api/gamification/my/points
 * @desc Get authenticated user's total points
 * @access Private
 */
export const getMyPoints = asyncHandler(async (req, res) => {
  const totalPoints = await gamificationRepository.getUserPoints(
    req.user.id
  );
  return sendSuccess(res, { totalPoints });
});

/**
 * @route GET /api/gamification/my/points/history
 * @desc Get authenticated user's points history (paginated)
 * @access Private
 */
export const getMyPointsHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await gamificationRepository.getPointsHistory(
    req.user.id,
    {
      page: parseInt(page),
      limit: parseInt(limit),
    }
  );

  return sendPaginated(res, result.entries, result.pagination);
});

/**
 * @route POST /api/gamification/points
 * @desc Award points and trigger badge check
 * @access Private
 */
export const awardPoints = asyncHandler(async (req, res) => {
  const { action, points, description, entityType, entityId } =
    req.body;

  if (!action || !VALID_ACTIONS.has(action)) {
    throw AppError.badRequest(
      `Invalid action. Must be one of: ${[...VALID_ACTIONS].join(', ')}`
    );
  }

  if (!points || typeof points !== 'number' || points <= 0) {
    throw AppError.badRequest(
      'Points must be a positive number'
    );
  }

  const entry = await gamificationRepository.addPoints(
    req.user.id,
    action,
    points,
    description,
    entityType,
    entityId
  );

  const awarded =
    await gamificationRepository.checkAndAwardBadges(req.user.id);

  return sendSuccess(
    res,
    { entry, awardedBadges: awarded },
    'Points awarded'
  );
});

/**
 * @route GET /api/gamification/leaderboard
 * @desc Get leaderboard (paginated)
 * @access Private
 */
export const getLeaderboard = asyncHandler(async (req, res) => {
  const {
    scope = 'global',
    period = 'all_time',
    page = 1,
    limit = 20,
  } = req.query;

  const result = await gamificationRepository.getLeaderboard(
    scope,
    period,
    {
      page: parseInt(page),
      limit: parseInt(limit),
    }
  );

  return sendPaginated(res, result.entries, result.pagination);
});

/**
 * @route POST /api/gamification/leaderboard/refresh
 * @desc Recalculate leaderboard rankings
 * @access Private
 */
export const refreshLeaderboard = asyncHandler(async (req, res) => {
  const { scope = 'global', period = 'all_time' } = req.body;

  const count = await gamificationRepository.updateLeaderboard(
    scope,
    period
  );

  return sendSuccess(
    res,
    { entriesUpdated: count },
    'Leaderboard refreshed'
  );
});

export default {
  listBadges,
  getMyBadges,
  getMyPoints,
  getMyPointsHistory,
  awardPoints,
  getLeaderboard,
  refreshLeaderboard,
};
