/**
 * Event Controller
 * Handles HTTP requests for local event endpoints
 */

import { sendSuccess, sendPaginated } from '../../../../shared/utils/response.js';
import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import prisma from '../../../../config/database.js';
import ticketmasterService from '../../infrastructure/services/TicketmasterService.js';
import eventRepository from '../../infrastructure/repositories/EventRepository.js';
import tripRepository from '../../../trip/infrastructure/repositories/TripRepository.js';

/**
 * Format a Date as Ticketmaster-compatible datetime string.
 * Example: "2024-01-15T00:00:00Z"
 */
function toTicketmasterDateTime(dateStr, end) {
  const d = new Date(dateStr);
  if (end) {
    d.setUTCHours(23, 59, 59, 0);
  } else {
    d.setUTCHours(0, 0, 0, 0);
  }
  return d.toISOString().replace('.000Z', 'Z');
}

function validateCity(city) {
  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    throw AppError.badRequest('city is required');
  }
  return city.trim();
}

function validateDateString(value, name) {
  if (!value) {
    throw AppError.badRequest(`${name} is required`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw AppError.badRequest(`${name} must be a valid date`);
  }
  return value;
}

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

/**
 * @route  GET /api/events/search
 * @desc   Search events by city and date range.
 *         Serves from DB cache when available; fetches from Ticketmaster otherwise.
 * @query  city, startDate, endDate, keyword?, category?, page?, limit?
 * @access Public (optionalAuth)
 */
const searchEvents = asyncHandler(async (req, res) => {
  const city = validateCity(req.query.city);
  const startDate = validateDateString(req.query.startDate, 'startDate');
  const endDate = validateDateString(req.query.endDate, 'endDate');
  const { keyword, category } = req.query;
  const { page, limit } = parsePagination(req.query);

  const cached = await eventRepository.searchCached(
    city, startDate, endDate, { category, page, limit },
  );

  if (cached.total > 0) {
    return sendPaginated(res, cached.events, {
      page,
      limit,
      total: cached.total,
    });
  }

  const tmStart = toTicketmasterDateTime(startDate, false);
  const tmEnd = toTicketmasterDateTime(endDate, true);

  const fetched = await ticketmasterService.searchEvents({
    city,
    startDate: tmStart,
    endDate: tmEnd,
    keyword,
    category,
    page: 0,
    size: 200,
  });

  if (fetched.length > 0) {
    await eventRepository.cacheEvents(fetched);
  }

  const result = await eventRepository.searchCached(
    city, startDate, endDate, { category, page, limit },
  );

  return sendPaginated(res, result.events, {
    page,
    limit,
    total: result.total,
  });
});

/**
 * @route  GET /api/events/nearby
 * @desc   Search events by geographic proximity.
 * @query  latitude, longitude, radius? (km, default 25),
 *         startDate?, endDate?, page?, limit?
 * @access Public (optionalAuth)
 */
const searchNearby = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    throw AppError.badRequest('latitude and longitude are required');
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (Number.isNaN(lat) || lat < -90 || lat > 90) {
    throw AppError.badRequest('latitude must be a number between -90 and 90');
  }
  if (Number.isNaN(lng) || lng < -180 || lng > 180) {
    throw AppError.badRequest(
      'longitude must be a number between -180 and 180',
    );
  }

  const radius = Math.min(
    500,
    Math.max(1, parseFloat(req.query.radius) || 25),
  );
  const { startDate, endDate } = req.query;
  const { page, limit } = parsePagination(req.query);

  const result = await eventRepository.searchByLocation(
    lat, lng, radius, { startDate, endDate, page, limit },
  );

  return sendPaginated(res, result.events, {
    page,
    limit,
    total: result.total,
  });
});

/**
 * @route  GET /api/events/:id
 * @desc   Get a single event by ID.
 * @access Public (optionalAuth)
 */
const getEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const event = await eventRepository.findById(id);
  if (!event) {
    throw AppError.notFound('Event not found');
  }

  return sendSuccess(res, { event });
});

/**
 * @route  GET /api/events/trips/:tripId/events
 * @desc   Get events for every city in a trip during the trip dates.
 * @access Private (authenticate)
 */
const getTripEvents = asyncHandler(async (req, res) => {
  const { tripId } = req.params;

  await tripRepository.verifyTripAccess(tripId, req.user.id);

  const cities = await prisma.trip_cities.findMany({
    where: { tripId },
    orderBy: { orderIndex: 'asc' },
  });
  if (cities.length === 0) {
    return sendSuccess(res, { cities: [] });
  }

  const results = [];

  for (const city of cities) {
    const startDate = city.startDate instanceof Date
      ? city.startDate.toISOString().slice(0, 10)
      : String(city.startDate).slice(0, 10);
    const endDate = city.endDate instanceof Date
      ? city.endDate.toISOString().slice(0, 10)
      : String(city.endDate).slice(0, 10);

    let cached = await eventRepository.searchCached(
      city.cityName, startDate, endDate, { page: 1, limit: 50 },
    );

    if (cached.total === 0) {
      const tmStart = toTicketmasterDateTime(startDate, false);
      const tmEnd = toTicketmasterDateTime(endDate, true);

      try {
        const fetched = await ticketmasterService.searchEvents({
          city: city.cityName,
          startDate: tmStart,
          endDate: tmEnd,
          page: 0,
          size: 50,
        });

        if (fetched.length > 0) {
          await eventRepository.cacheEvents(fetched);
        }
      } catch (error) {
        console.error(
          `[Events] Failed to fetch events for ${city.cityName}:`,
          error.message,
        );
      }

      cached = await eventRepository.searchCached(
        city.cityName, startDate, endDate, { page: 1, limit: 50 },
      );
    }

    results.push({
      city: city.cityName,
      countryCode: city.countryCode || null,
      startDate,
      endDate,
      events: cached.events,
      total: cached.total,
    });
  }

  return sendSuccess(res, { cities: results });
});

export default { searchEvents, searchNearby, getEventById, getTripEvents };
