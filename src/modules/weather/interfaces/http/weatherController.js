/**
 * Weather Controller
 * Handles HTTP requests for weather forecast endpoints
 */

import { sendSuccess } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import openMeteoService from '../../infrastructure/services/OpenMeteoService.js';
import weatherRepository from '../../infrastructure/repositories/WeatherRepository.js';
import tripRepository from '../../../trip/infrastructure/repositories/TripRepository.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateCoords(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    throw AppError.badRequest('latitude must be a number between -90 and 90');
  }
  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    throw AppError.badRequest(
      'longitude must be a number between -180 and 180'
    );
  }

  return { lat, lng };
}

function validateDateRange(startDate, endDate) {
  if (!ISO_DATE_RE.test(startDate)) {
    throw AppError.badRequest(
      'startDate must be a valid ISO date (YYYY-MM-DD)'
    );
  }
  if (!ISO_DATE_RE.test(endDate)) {
    throw AppError.badRequest(
      'endDate must be a valid ISO date (YYYY-MM-DD)'
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime())) {
    throw AppError.badRequest('startDate is not a valid date');
  }
  if (Number.isNaN(end.getTime())) {
    throw AppError.badRequest('endDate is not a valid date');
  }
  if (start > end) {
    throw AppError.badRequest('startDate must not be after endDate');
  }
}

/**
 * Count dates in a range (inclusive).
 */
function daysBetween(startDate, endDate) {
  const ms = new Date(endDate) - new Date(startDate);
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * @route  GET /api/weather/forecast
 * @desc   Get weather forecast for a location + date range.
 *         Serves from DB cache when available; fetches from Open-Meteo otherwise.
 * @query  latitude, longitude, startDate, endDate, city?
 * @access Public (optionalAuth)
 */
const getForecast = asyncHandler(async (req, res) => {
  const { latitude, longitude, startDate, endDate, city } = req.query;

  if (!latitude || !longitude || !startDate || !endDate) {
    throw AppError.badRequest(
      'latitude, longitude, startDate and endDate are required'
    );
  }

  const { lat, lng } = validateCoords(latitude, longitude);
  validateDateRange(startDate, endDate);

  const expectedDays = daysBetween(startDate, endDate);
  const cached = await weatherRepository.getCachedForecast(
    lat, lng, startDate, endDate,
  );

  if (cached.length >= expectedDays) {
    return sendSuccess(res, { forecasts: cached, source: 'cache' });
  }

  const forecasts = await openMeteoService.fetchForecast(
    Math.round(lat * 100) / 100,
    Math.round(lng * 100) / 100,
    startDate,
    endDate,
  );

  await weatherRepository.cacheForecast(
    city || 'Unknown',
    null,
    lat,
    lng,
    forecasts,
  );

  return sendSuccess(res, { forecasts, source: 'api' });
});

/**
 * @route  GET /api/weather/trips/:tripId/weather
 * @desc   Get weather for every city/date in a trip.
 *         Fetches missing data from Open-Meteo and caches it.
 * @access Private (authenticate)
 */
const getTripWeather = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  await tripRepository.verifyTripAccess(tripId, req.user.id);

  const cityForecasts = await weatherRepository.getForecastForTrip(tripId);

  for (const entry of cityForecasts) {
    if (entry.latitude == null || entry.longitude == null) {
      continue;
    }

    const start = entry.startDate instanceof Date
      ? entry.startDate.toISOString().slice(0, 10)
      : String(entry.startDate).slice(0, 10);
    const end = entry.endDate instanceof Date
      ? entry.endDate.toISOString().slice(0, 10)
      : String(entry.endDate).slice(0, 10);

    const expectedDays = daysBetween(start, end);

    if (entry.forecasts.length >= expectedDays) {
      continue;
    }

    try {
      const lat = Math.round(entry.latitude * 100) / 100;
      const lng = Math.round(entry.longitude * 100) / 100;

      const fetched = await openMeteoService.fetchForecast(
        lat, lng, start, end,
      );

      await weatherRepository.cacheForecast(
        entry.city,
        entry.countryCode,
        entry.latitude,
        entry.longitude,
        fetched,
      );

      entry.forecasts = fetched;
    } catch (error) {
      console.error(
        `[Weather] Failed to fetch forecast for ${entry.city}:`,
        error.message,
      );
    }
  }

  return sendSuccess(res, { cities: cityForecasts });
});

export default { getForecast, getTripWeather };
