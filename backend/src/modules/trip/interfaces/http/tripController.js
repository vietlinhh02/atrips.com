/**
 * Trip Controller
 * Handles HTTP requests for trip endpoints
 */

import { validationResult } from 'express-validator';
import { sendSuccess, sendCreated, sendValidationError } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import createTripUseCase from '../../application/useCases/CreateTripUseCase.js';
import applyAIDraftUseCase from '../../application/useCases/ApplyAIDraftUseCase.js';
import modifyTripWithAIUseCase from '../../application/useCases/ModifyTripWithAIUseCase.js';
import tripRepository from '../../infrastructure/repositories/TripRepository.js';
import activityRepository from '../../infrastructure/repositories/ActivityRepository.js';
import novuService from '../../../notification/application/NovuService.js';

export const createTrip = asyncHandler(async (req, res) => {
  // ═══════════════════════════════════════════════════════════════
  // DIRECT TRIP CREATION DISABLED
  // All trips must be created through AI-powered planning
  // ═══════════════════════════════════════════════════════════════
  throw AppError.badRequest(
    'Direct trip creation is not available. Please use AI-powered trip planning:\n' +
    '1. Start a conversation with AI: POST /api/ai/chat\n' +
    '2. Request trip planning: "Plan a trip to [destination] from [date] to [date]"\n' +
    '3. Review the generated draft\n' +
    '4. Apply the draft: POST /api/trips/drafts/{draftId}/apply'
  );

  // ═══════════════════════════════════════════════════════════════
  // ORIGINAL CODE (DISABLED)
  // ═══════════════════════════════════════════════════════════════
  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   return sendValidationError(res, errors.array());
  // }

  // const { title, description, startDate, endDate, travelersCount, budgetTotal, budgetCurrency, coverImageUrl } = req.body;

  // const result = await createTripUseCase.execute({
  //   title,
  //   description,
  //   startDate,
  //   endDate,
  //   travelersCount,
  //   budgetTotal,
  //   budgetCurrency,
  //   coverImageUrl,
  //   ownerId: req.user.id,
  // });

  // return sendCreated(res, result, result.message);
});

export const getTrip = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const trip = await tripRepository.getTripWithItinerary(id, req.user.id);

  if (!trip) {
    throw AppError.notFound('Trip not found');
  }

  return sendSuccess(res, { trip });
});

export const listTrips = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;

  const filters = {};
  if (status) {
    filters.status = status;
  }

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
  };

  const result = await tripRepository.getUserTrips(req.user.id, filters, pagination);

  return sendSuccess(res, result);
});

export const updateTrip = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { id } = req.params;
  const updates = req.body;

  const trip = await tripRepository.updateTrip(id, updates, req.user.id);

  // Notify trip members about the update
  tripRepository.getTripMembers(id).then((members) => {
    const otherMembers = members
      .filter((m) => m.userId !== req.user.id)
      .map((m) => m.userId);
    if (otherMembers.length > 0) {
      novuService.triggerBulk('trip-update', otherMembers, {
        tripId: id,
        tripName: trip.title,
      }, req.user.id);
    }
  });

  return sendSuccess(res, { trip: trip.toJSON() }, 'Trip updated successfully');
});

export const deleteTrip = asyncHandler(async (req, res) => {
  const { id } = req.params;

  await tripRepository.deleteTrip(id, req.user.id);

  return sendSuccess(res, null, 'Trip deleted successfully');
});

export const applyAIDraft = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { draftId } = req.params;
  const { createNew = true, existingTripId } = req.body;

  const result = await applyAIDraftUseCase.execute({
    draftId,
    userId: req.user.id,
    createNew,
    existingTripId,
  });

  return sendCreated(res, result, result.message);
});

export const modifyTripWithAI = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { tripId } = req.params;
  const { message, conversationId } = req.body;

  const result = await modifyTripWithAIUseCase.execute({
    tripId,
    message,
    userId: req.user.id,
    conversationId,
  });

  return sendSuccess(res, result, result.message);
});

export const addActivity = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { tripId, dayId } = req.params;

  await tripRepository.verifyTripOwnership(tripId, req.user.id);

  const activity = await activityRepository.create({
    itineraryDayId: dayId,
    createdById: req.user.id,
    ...req.body,
  });

  return sendCreated(res, { activity }, 'Activity added successfully');
});

export const updateActivity = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { tripId, activityId } = req.params;

  await tripRepository.verifyTripOwnership(tripId, req.user.id);

  const activity = await activityRepository.update(activityId, req.body);

  return sendSuccess(res, { activity }, 'Activity updated successfully');
});

export const deleteActivity = asyncHandler(async (req, res) => {
  const { tripId, activityId } = req.params;

  await tripRepository.verifyTripOwnership(tripId, req.user.id);

  await activityRepository.delete(activityId);

  return sendSuccess(res, null, 'Activity deleted successfully');
});

export const reorderActivities = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }

  const { tripId, dayId } = req.params;
  const { activityIds } = req.body;

  if (!Array.isArray(activityIds)) {
    throw AppError.badRequest('activityIds must be an array');
  }

  await tripRepository.verifyTripOwnership(tripId, req.user.id);

  await activityRepository.reorder(dayId, activityIds);

  return sendSuccess(res, null, 'Activities reordered successfully');
});
