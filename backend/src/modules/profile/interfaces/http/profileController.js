/**
 * Profile Controller
 * Handles HTTP requests for travel profile endpoints
 */

import { sendSuccess } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import travelProfileRepository from '../../infrastructure/repositories/TravelProfileRepository.js';

/**
 * @route GET /api/profile/travel/needs-onboarding
 * @desc Check if user needs travel profile onboarding
 * @access Private
 */
export const checkOnboarding = asyncHandler(async (req, res) => {
  const result = await travelProfileRepository.needsOnboarding(req.user.id);

  return sendSuccess(res, result);
});

/**
 * @route GET /api/profile/travel
 * @desc Get user's travel profile
 * @access Private
 */
export const getTravelProfile = asyncHandler(async (req, res) => {
  const profile = await travelProfileRepository.findByUserId(req.user.id);

  return sendSuccess(res, { profile });
});

/**
 * @route PATCH /api/profile/travel
 * @desc Update user's travel profile
 * @access Private
 */
export const updateTravelProfile = asyncHandler(async (req, res) => {
  const profile = await travelProfileRepository.upsert(req.user.id, req.body);

  return sendSuccess(res, { profile }, 'Travel profile updated successfully');
});

/**
 * @route POST /api/profile/travel/complete
 * @desc Mark travel profile onboarding as complete
 * @access Private
 */
export const completeOnboarding = asyncHandler(async (req, res) => {
  const profile = await travelProfileRepository.upsert(req.user.id, {
    ...req.body,
    completedAt: new Date(),
  });

  return sendSuccess(res, { profile }, 'Onboarding completed successfully');
});

export default {
  checkOnboarding,
  getTravelProfile,
  updateTravelProfile,
  completeOnboarding,
};
