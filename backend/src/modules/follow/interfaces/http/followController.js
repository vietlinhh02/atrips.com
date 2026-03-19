/**
 * Follow Controller
 * Handles HTTP requests for user-follows-user endpoints
 */

import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
} from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import followRepository from '../../infrastructure/repositories/FollowRepository.js';

/**
 * @route POST /api/users/:userId/follow
 * @desc Follow a user
 * @access Private
 */
export const followUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (req.user.id === userId) {
    throw AppError.badRequest('You cannot follow yourself');
  }

  await followRepository.follow(req.user.id, userId);
  const counts = await followRepository.getFollowCounts(userId);

  return sendCreated(
    res,
    { isFollowing: true, ...counts },
    'User followed'
  );
});

/**
 * @route DELETE /api/users/:userId/follow
 * @desc Unfollow a user
 * @access Private
 */
export const unfollowUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  await followRepository.unfollow(req.user.id, userId);

  return sendNoContent(res);
});

/**
 * @route GET /api/users/:userId/followers
 * @desc List a user's followers (paginated)
 * @access Public
 */
export const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const result = await followRepository.getFollowers(userId, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  return sendPaginated(
    res,
    result.users,
    result.pagination
  );
});

/**
 * @route GET /api/users/:userId/following
 * @desc List users that a user is following (paginated)
 * @access Public
 */
export const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const result = await followRepository.getFollowing(userId, {
    page: parseInt(page),
    limit: parseInt(limit),
  });

  return sendPaginated(
    res,
    result.users,
    result.pagination
  );
});

/**
 * @route GET /api/users/:userId/follow-status
 * @desc Check if current user follows the target user, plus counts
 * @access Private
 */
export const getFollowStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const [isFollowing, counts] = await Promise.all([
    followRepository.isFollowing(req.user.id, userId),
    followRepository.getFollowCounts(userId),
  ]);

  return sendSuccess(res, {
    isFollowing,
    ...counts,
  });
});

export default {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus,
};
