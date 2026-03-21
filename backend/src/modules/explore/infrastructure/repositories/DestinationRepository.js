import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';
import { AppError } from '../../../../shared/errors/AppError.js';

const CACHE_TTL = {
  DESTINATION_DETAIL: 3600,
  DESTINATION_LIST: 600,
  TRENDING: 21600,
};

const CACHE_KEYS = {
  DETAIL: (id) => `explore:dest:${id}`,
  TRENDING: (season) => `explore:trending:${season}`,
  SEARCH: (query, offset) =>
    `explore:search:${query.toLowerCase().trim()}:${offset}`,
};

const DESTINATION_INCLUDE = {
  cached_place: {
    select: {
      id: true,
      name: true,
      city: true,
      country: true,
      countryCode: true,
      latitude: true,
      longitude: true,
      rating: true,
      ratingCount: true,
      photos: true,
      categories: true,
    },
  },
};

class DestinationRepository {
  async findById(id) {
    const cacheKey = CACHE_KEYS.DETAIL(id);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const destination = await prisma.destinations.findUnique({
      where: { id },
      include: DESTINATION_INCLUDE,
    });

    if (!destination) {
      throw AppError.notFound('Destination not found');
    }

    await cacheService.set(
      cacheKey, destination, CACHE_TTL.DESTINATION_DETAIL,
    );
    return destination;
  }

  async findActive({ limit = 20, offset = 0 } = {}) {
    return prisma.destinations.findMany({
      where: { isActive: true },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async countActive(where = { isActive: true }) {
    return prisma.destinations.count({ where });
  }

  async findByRegion(region, { limit = 20, offset = 0 } = {}) {
    return prisma.destinations.findMany({
      where: { isActive: true, region },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findBySeason(season, { limit = 20, offset = 0 } = {}) {
    return prisma.destinations.findMany({
      where: {
        isActive: true,
        bestSeasons: { has: season },
      },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async findByTags(tags, { limit = 20, offset = 0 } = {}) {
    return prisma.destinations.findMany({
      where: {
        isActive: true,
        tags: { hasSome: tags },
      },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async search(query, { limit = 20, offset = 0 } = {}) {
    const normalized = query.toLowerCase().trim();
    const cacheKey = CACHE_KEYS.SEARCH(normalized, offset);
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const lowerQuery = `%${normalized}%`;

    const items = await prisma.$queryRaw`
      SELECT d.*,
        json_build_object(
          'id', cp.id, 'name', cp.name, 'city', cp.city,
          'country', cp.country, 'latitude', cp.latitude,
          'longitude', cp.longitude, 'rating', cp.rating,
          'photos', cp.photos, 'categories', cp.categories
        ) as cached_place
      FROM destinations d
      JOIN cached_places cp ON d."cachedPlaceId" = cp.id
      WHERE d."isActive" = true
        AND (
          LOWER(cp.city) LIKE ${lowerQuery}
          OR LOWER(cp.country) LIKE ${lowerQuery}
          OR LOWER(d.tagline) LIKE ${lowerQuery}
          OR EXISTS (
            SELECT 1 FROM unnest(d.tags) t
            WHERE LOWER(t) LIKE ${lowerQuery}
          )
        )
      ORDER BY d."popularityScore" DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*)::int as total
      FROM destinations d
      JOIN cached_places cp ON d."cachedPlaceId" = cp.id
      WHERE d."isActive" = true
        AND (
          LOWER(cp.city) LIKE ${lowerQuery}
          OR LOWER(cp.country) LIKE ${lowerQuery}
          OR LOWER(d.tagline) LIKE ${lowerQuery}
          OR EXISTS (
            SELECT 1 FROM unnest(d.tags) t
            WHERE LOWER(t) LIKE ${lowerQuery}
          )
        )
    `;

    const result = {
      items,
      total: countResult[0]?.total ?? 0,
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.DESTINATION_LIST);
    return result;
  }

  async updatePopularityScore(id, score) {
    await prisma.destinations.update({
      where: { id },
      data: { popularityScore: score },
    });
    await cacheService.del(CACHE_KEYS.DETAIL(id));
  }

  async findSimilar(destination, { limit = 6 } = {}) {
    return prisma.destinations.findMany({
      where: {
        isActive: true,
        id: { not: destination.id },
        OR: [
          { region: destination.region },
          { tags: { hasSome: destination.tags.slice(0, 3) } },
        ],
      },
      include: DESTINATION_INCLUDE,
      orderBy: { popularityScore: 'desc' },
      take: limit,
    });
  }

  async invalidateUserCache(userId) {
    await cacheService.delPattern(`explore:user:${userId}:*`);
  }
}

export default new DestinationRepository();
