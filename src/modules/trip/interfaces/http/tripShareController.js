import { sendSuccess, sendCreated } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import tripShareRepository from '../../infrastructure/repositories/TripShareRepository.js';
import tripAdvancedRepository from '../../infrastructure/repositories/TripAdvancedRepository.js';

export const shareTrip = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const userId = req.user.id;

  const { shareToken } = await tripShareRepository.generateShareToken(
    tripId,
    userId
  );

  return sendCreated(
    res,
    { shareToken },
    'Trip shared successfully'
  );
});

export const revokeShare = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const userId = req.user.id;

  await tripShareRepository.revokeShareToken(tripId, userId);

  return sendSuccess(res, null, 'Share link revoked');
});

export const getSharedTrip = asyncHandler(async (req, res) => {
  const { shareToken } = req.params;

  const trip = await tripShareRepository.findTripByShareToken(shareToken);

  if (!trip) {
    throw AppError.notFound(
      'Trip not found or link has been revoked'
    );
  }

  const { ownerId, ...sanitized } = trip;

  return sendSuccess(res, { trip: sanitized });
});

export const duplicateSharedTrip = asyncHandler(async (req, res) => {
  const { shareToken } = req.params;
  const userId = req.user.id;

  const trip = await tripShareRepository.findTripByShareToken(shareToken);

  if (!trip) {
    throw AppError.notFound(
      'Trip not found or link has been revoked'
    );
  }

  const newTrip = await tripAdvancedRepository.duplicateTripByData(
    trip,
    userId
  );

  return sendCreated(
    res,
    { trip: newTrip },
    'Trip duplicated to your account'
  );
});
