/**
 * Activity Vote Controller
 * Handles HTTP requests for activity voting endpoints
 */

import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from '../../../../shared/utils/response.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import activityVoteRepository, {
  VALID_VOTE_TYPES,
} from '../../infrastructure/repositories/ActivityVoteRepository.js';
import activityRepository
  from '../../infrastructure/repositories/ActivityRepository.js';

/**
 * GET /activities/:activityId/votes
 * Get vote summary for an activity
 */
export const getVoteSummary = asyncHandler(async (req, res) => {
  const { activityId } = req.params;

  const activity = await activityRepository.getById(activityId);
  if (!activity) {
    throw AppError.notFound('Activity not found');
  }

  const summary = await activityVoteRepository.getVoteSummary(
    activityId,
    req.user.id,
  );

  return sendSuccess(res, summary);
});

/**
 * GET /trips/:tripId/votes
 * Get vote summaries for all activities in a trip
 */
export const getTripVoteSummaries = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  const summaries = await activityVoteRepository.getVoteSummariesForTrip(
    tripId,
    req.user.id,
  );

  return sendSuccess(res, { votes: summaries });
});

/**
 * POST /activities/:activityId/votes
 * Cast or update a vote on an activity
 */
export const castVote = asyncHandler(async (req, res) => {
  const { activityId } = req.params;
  const { vote } = req.body;

  if (!vote || !VALID_VOTE_TYPES.includes(vote)) {
    throw AppError.badRequest(
      'Invalid vote type. Must be "UP" or "DOWN"',
    );
  }

  const activity = await activityRepository.getById(activityId);
  if (!activity) {
    throw AppError.notFound('Activity not found');
  }

  const result = await activityVoteRepository.upsertVote(
    activityId,
    req.user.id,
    vote,
  );

  return sendCreated(res, { vote: result }, 'Vote recorded');
});

/**
 * DELETE /activities/:activityId/votes
 * Remove the authenticated user's vote
 */
export const removeVote = asyncHandler(async (req, res) => {
  const { activityId } = req.params;

  const existing = await activityVoteRepository.getUserVote(
    activityId,
    req.user.id,
  );

  if (!existing) {
    throw AppError.notFound('Vote not found');
  }

  await activityVoteRepository.removeVote(activityId, req.user.id);

  return sendNoContent(res);
});
