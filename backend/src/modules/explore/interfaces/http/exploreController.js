import { asyncHandler } from '../../../../shared/middleware/errorHandler.js';
import { sendSuccess } from '../../../../shared/utils/response.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import destinationRepository from '../../infrastructure/repositories/DestinationRepository.js';
import scoringService from '../../application/services/ScoringService.js';
import enhancementService from '../../application/services/ExploreEnhancementService.js';
import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

const SECTION_LIMIT = 8;

async function getUserContext(userId) {
  if (!userId) return { travelProfile: null, userTrips: null };

  const [travelProfile, userTrips] = await Promise.all([
    prisma.travel_profiles.findUnique({ where: { userId } }),
    prisma.trips.findMany({
      where: { ownerId: userId, status: { in: ['COMPLETED', 'ACTIVE'] } },
      select: {
        endDate: true,
        itinerary_days: {
          select: {
            activities: {
              select: {
                cached_places: {
                  select: { city: true },
                },
              },
            },
          },
        },
      },
      orderBy: { endDate: 'desc' },
      take: 10,
    }),
  ]);

  const flatTrips = userTrips.map((trip) => ({
    endDate: trip.endDate,
    activities: trip.itinerary_days.flatMap((d) => d.activities),
  }));

  return { travelProfile, userTrips: flatTrips };
}

export const getExplore = asyncHandler(async (req, res) => {
  const userId = req.user?.id ?? null;
  const section = req.query.section ?? null;
  const limit = Math.min(
    parseInt(req.query.limit, 10) || SECTION_LIMIT, 50,
  );
  const offset = parseInt(req.query.offset, 10) || 0;

  const allDestinations = await destinationRepository.findActive({
    limit: 200,
    offset: 0,
  });

  const { travelProfile, userTrips } = await getUserContext(userId);
  const context = { travelProfile, userTrips };

  if (section) {
    const sectionData = await buildSection(
      section, allDestinations, context, limit, offset,
    );
    return sendSuccess(res, sectionData);
  }

  const sections = userId
    ? await buildAuthSections(allDestinations, context, limit)
    : await buildGuestSections(allDestinations, context, limit);

  return sendSuccess(res, sections);
});

async function buildSection(name, destinations, context, limit, offset) {
  const ranked = scoringService.rankDestinations(destinations, context);
  let filtered;

  switch (name) {
    case 'forYou':
      filtered = ranked;
      break;
    case 'trending':
      filtered = ranked.filter((d) =>
        scoringService.scoreSeasonMatch(d) > 0.5,
      );
      break;
    case 'budgetFriendly':
      filtered = ranked.filter(
        (d) => d.avgDailyBudget
          && parseFloat(d.avgDailyBudget) <= 60,
      );
      break;
    default:
      filtered = ranked;
  }

  const items = filtered.slice(offset, offset + limit);
  return {
    items,
    total: filtered.length,
    hasMore: offset + limit < filtered.length,
  };
}

async function buildAuthSections(destinations, context, limit) {
  const ranked = scoringService.rankDestinations(destinations, context);

  const trending = ranked.filter((d) =>
    scoringService.scoreSeasonMatch(d) > 0.5,
  );

  const budgetFriendly = ranked.filter(
    (d) => d.avgDailyBudget
      && parseFloat(d.avgDailyBudget) <= 60,
  );

  return {
    forYou: paginate(ranked, limit),
    trending: paginate(trending, limit),
    budgetFriendly: paginate(budgetFriendly, limit),
  };
}

async function buildGuestSections(destinations, context, limit) {
  const ranked = scoringService.rankDestinations(destinations, context);

  const trending = ranked.filter((d) =>
    scoringService.scoreSeasonMatch(d) > 0.5,
  );

  return {
    trending: paginate(trending, limit),
    popular: paginate(ranked, limit),
  };
}

function paginate(items, limit) {
  return {
    items: items.slice(0, limit),
    total: items.length,
    hasMore: items.length > limit,
  };
}

export const getDestination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const destination = await destinationRepository.findById(id);

  const [similar, weather] = await Promise.all([
    destinationRepository.findSimilar(destination),
    fetchWeather(destination.cached_place),
  ]);

  return sendSuccess(res, {
    destination,
    weather,
    similarDestinations: similar,
  });
});

async function fetchWeather(place) {
  if (!place.latitude || !place.longitude) return null;

  const cacheKey =
    `explore:weather:${place.latitude}:${place.longitude}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', place.latitude);
    url.searchParams.set('longitude', place.longitude);
    url.searchParams.set(
      'current', 'temperature_2m,weather_code',
    );
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,weather_code',
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');

    const response = await fetch(url.toString());
    const data = await response.json();

    const weather = {
      current: {
        temperature: data.current?.temperature_2m,
        weatherCode: data.current?.weather_code,
      },
      forecast: data.daily?.time?.map((date, i) => ({
        date,
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        weatherCode: data.daily.weather_code[i],
      })) ?? [],
    };

    await cacheService.set(cacheKey, weather, 10800);
    return weather;
  } catch {
    return null;
  }
}

export const searchDestinations = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim();
  if (!query || query.length < 2) {
    throw AppError.badRequest(
      'Search query must be at least 2 characters',
    );
  }

  const limit = Math.min(
    parseInt(req.query.limit, 10) || 20, 50,
  );
  const offset = parseInt(req.query.offset, 10) || 0;

  const result = await destinationRepository.search(
    query, { limit, offset },
  );

  return sendSuccess(res, {
    items: result.items,
    total: result.total,
    hasMore: offset + limit < result.total,
  });
});

export const enhanceDestinations = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { destinationIds } = req.body;

  if (!Array.isArray(destinationIds) || destinationIds.length === 0) {
    throw AppError.badRequest(
      'destinationIds must be a non-empty array',
    );
  }

  if (destinationIds.length > 20) {
    throw AppError.badRequest(
      'Maximum 20 destinations per request',
    );
  }

  const result = await enhancementService.enhance(
    destinationIds, userId,
  );
  return sendSuccess(res, result);
});
