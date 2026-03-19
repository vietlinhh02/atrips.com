/**
 * Flight Controller
 * Handles HTTP requests for flight search and price tracking endpoints
 */

import {
  sendSuccess,
  sendCreated,
  sendNoContent,
  sendPaginated,
} from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import amadeusService
  from '../../infrastructure/services/AmadeusService.js';
import flightRepository
  from '../../infrastructure/repositories/FlightRepository.js';

const IATA_CODE_RE = /^[A-Z]{3}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const VALID_CABIN_CLASSES = [
  'economy',
  'premium_economy',
  'business',
  'first',
];

function validateIataCode(value, fieldName) {
  if (!value || !IATA_CODE_RE.test(value)) {
    throw AppError.badRequest(
      `${fieldName} must be a 3-letter uppercase IATA code`
    );
  }
}

function validateDate(value, fieldName) {
  if (!value || !ISO_DATE_RE.test(value)) {
    throw AppError.badRequest(
      `${fieldName} must be a valid date (YYYY-MM-DD)`
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw AppError.badRequest(`${fieldName} is not a valid date`);
  }
}

/**
 * @route  GET /api/flights/search
 * @desc   Search flights via Amadeus and save to history
 * @query  origin, destination, departDate, returnDate?,
 *         passengers?, cabinClass?
 * @access Private
 */
const searchFlights = asyncHandler(async (req, res) => {
  const {
    origin,
    destination,
    departDate,
    returnDate,
    passengers,
    cabinClass,
  } = req.query;

  validateIataCode(origin, 'origin');
  validateIataCode(destination, 'destination');
  validateDate(departDate, 'departDate');

  if (returnDate) {
    validateDate(returnDate, 'returnDate');
  }

  const parsedPassengers = passengers ? parseInt(passengers, 10) : 1;
  if (
    Number.isNaN(parsedPassengers)
    || parsedPassengers < 1
    || parsedPassengers > 9
  ) {
    throw AppError.badRequest('passengers must be between 1 and 9');
  }

  const resolvedCabin = cabinClass || 'economy';
  if (!VALID_CABIN_CLASSES.includes(resolvedCabin)) {
    throw AppError.badRequest(
      `cabinClass must be one of: ${VALID_CABIN_CLASSES.join(', ')}`
    );
  }

  const result = await amadeusService.searchFlights({
    origin,
    destination,
    departDate,
    returnDate: returnDate || null,
    passengers: parsedPassengers,
    cabinClass: resolvedCabin,
  });

  flightRepository
    .saveSearch(req.user.id, {
      origin,
      destination,
      departDate,
      returnDate: returnDate || null,
      passengers: parsedPassengers,
      cabinClass: resolvedCabin,
    })
    .catch((err) => {
      console.error('[Flight] Failed to save search history:', err.message);
    });

  return sendSuccess(res, result);
});

/**
 * @route  GET /api/flights/search/history
 * @desc   Get user's flight search history (paginated)
 * @access Private
 */
const getSearchHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await flightRepository.getSearchHistory(req.user.id, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });

  return sendPaginated(
    res,
    result.searches,
    result.pagination
  );
});

/**
 * @route  POST /api/flights/trackings
 * @desc   Create a price tracking for a flight route
 * @body   { origin, destination, departDate, returnDate?,
 *           priceThreshold?, currency? }
 * @access Private
 */
const createTracking = asyncHandler(async (req, res) => {
  const {
    origin,
    destination,
    departDate,
    returnDate,
    priceThreshold,
    currency,
  } = req.body;

  validateIataCode(origin, 'origin');
  validateIataCode(destination, 'destination');
  validateDate(departDate, 'departDate');

  if (returnDate) {
    validateDate(returnDate, 'returnDate');
  }

  if (priceThreshold !== undefined && priceThreshold !== null) {
    const threshold = Number(priceThreshold);
    if (Number.isNaN(threshold) || threshold <= 0) {
      throw AppError.badRequest(
        'priceThreshold must be a positive number'
      );
    }
  }

  const tracking = await flightRepository.createTracking(req.user.id, {
    origin,
    destination,
    departDate,
    returnDate: returnDate || null,
    priceThreshold: priceThreshold ?? null,
    currency: currency || 'USD',
  });

  return sendCreated(res, { tracking }, 'Price tracking created');
});

/**
 * @route  GET /api/flights/trackings
 * @desc   Get user's active price trackings (paginated)
 * @access Private
 */
const getUserTrackings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const result = await flightRepository.getUserTrackings(req.user.id, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  });

  return sendPaginated(
    res,
    result.trackings,
    result.pagination
  );
});

/**
 * @route  DELETE /api/flights/trackings/:id
 * @desc   Delete a price tracking
 * @access Private (owner only)
 */
const deleteTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await flightRepository.deleteTracking(id, req.user.id);

  if (result.count === 0) {
    throw AppError.notFound('Tracking not found');
  }

  return sendNoContent(res);
});

/**
 * @route  PATCH /api/flights/trackings/:id/deactivate
 * @desc   Deactivate a price tracking
 * @access Private (owner only)
 */
const deactivateTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await flightRepository.deactivateTracking(
    id,
    req.user.id
  );

  if (result.count === 0) {
    throw AppError.notFound('Tracking not found');
  }

  return sendSuccess(res, null, 'Tracking deactivated');
});

export default {
  searchFlights,
  getSearchHistory,
  createTracking,
  getUserTrackings,
  deleteTracking,
  deactivateTracking,
};
