import { query, validationResult } from 'express-validator';
import {
  sendSuccess,
  sendValidationError,
} from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import placeEnrichmentService from '../../application/services/PlaceEnrichmentService.js';

export const enrichPlace = asyncHandler(async (req, res) => {
  const { placeId } = req.params;

  const place = await placeEnrichmentService.enrichPlaceFull(placeId);

  if (!place) {
    throw AppError.notFound('Place not found');
  }

  return sendSuccess(res, { place });
});

export const searchPlaces = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors.array());

  const { query: q, lat, lng } = req.query;

  const places = await placeEnrichmentService.searchPlaces(
    q,
    lat ? parseFloat(lat) : null,
    lng ? parseFloat(lng) : null
  );

  return sendSuccess(res, { places });
});

export const lookupPlace = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidationError(res, errors.array());

  const { name } = req.query;

  const places = await placeEnrichmentService.searchPlaces(name, null, null);
  if (!places || places.length === 0) {
    throw AppError.notFound('Place not found');
  }

  const place = await placeEnrichmentService.enrichPlaceFull(places[0].id);
  return sendSuccess(res, { place: place || places[0] });
});

export const lookupPlaceValidation = [
  query('name')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Name is required'),
];

export const searchPlacesValidation = [
  query('query')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Query is required'),
  query('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  query('lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
];
