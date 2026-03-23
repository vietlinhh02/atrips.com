/**
 * Profile Controller
 * Handles HTTP requests for travel profile endpoints
 */

import { sendSuccess } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import travelProfileRepository from '../../infrastructure/repositories/TravelProfileRepository.js';
import { TRAVEL_PROFILE_OPTIONS } from '../../domain/travelProfileOptions.js';

/**
 * @route GET /api/profile/travel/options
 * @desc Get travel profile options for onboarding UI
 * @access Private
 */
export const getOptions = asyncHandler(async (req, res) => {
  return sendSuccess(res, { options: TRAVEL_PROFILE_OPTIONS });
});

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
 * @route PUT /api/profile/travel/step1
 * @desc Update step 1 of travel profile
 * @access Private
 */
export const updateStep1 = asyncHandler(async (req, res) => {
  const { firstName, lastName, age, gender, travelCompanions, location, locationPlaceId } = req.body;
  const profile = await travelProfileRepository.upsert(req.user.id, {
    firstName,
    lastName,
    age: age ? parseInt(age, 10) : null,
    gender,
    travelCompanions: travelCompanions || [],
    location,
    locationPlaceId,
    currentStep: 2,
  });

  return sendSuccess(res, { profile }, 'Step 1 saved');
});

/**
 * @route PUT /api/profile/travel/step2
 * @desc Update step 2 of travel profile
 * @access Private
 */
export const updateStep2 = asyncHandler(async (req, res) => {
  const { spendingHabits, dailyRhythm, socialPreference } = req.body;
  const profile = await travelProfileRepository.upsert(req.user.id, {
    spendingHabits,
    dailyRhythm,
    socialPreference,
    currentStep: 3,
  });

  return sendSuccess(res, { profile }, 'Step 2 saved');
});

/**
 * @route PUT /api/profile/travel/step3
 * @desc Update step 3 of travel profile and generate persona
 * @access Private
 */
export const updateStep3 = asyncHandler(async (req, res) => {
  const { travelerTypes } = req.body;
  const types = travelerTypes || [];

  const selectedOptions = TRAVEL_PROFILE_OPTIONS.travelerTypes.filter(
    (t) => types.includes(t.value),
  );

  const personaTitle = selectedOptions.length > 0
    ? selectedOptions.map((t) => t.persona.title).join(' & ')
    : 'Your Travel Persona';

  const personaDescription = selectedOptions.length > 0
    ? selectedOptions.map((t) => t.persona.description).join(' ')
    : '';

  const personaSuggestedQuestions = selectedOptions
    .flatMap((t) => t.suggestedQuestions)
    .slice(0, 6);

  const profile = await travelProfileRepository.upsert(req.user.id, {
    travelerTypes: types,
    personaTitle,
    personaDescription,
    personaSuggestedQuestions,
    currentStep: 4,
  });

  return sendSuccess(res, { profile }, 'Step 3 saved');
});

/**
 * @route PUT /api/profile/travel/step4
 * @desc Update step 4 (persona answers) and complete onboarding
 * @access Private
 */
export const updateStep4 = asyncHandler(async (req, res) => {
  const { answers } = req.body;
  const profile = await travelProfileRepository.upsert(req.user.id, {
    personaAnswers: answers || {},
    completedAt: new Date(),
  });

  return sendSuccess(res, { profile }, 'Onboarding completed');
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
  getOptions,
  checkOnboarding,
  getTravelProfile,
  updateTravelProfile,
  updateStep1,
  updateStep2,
  updateStep3,
  updateStep4,
  completeOnboarding,
};
