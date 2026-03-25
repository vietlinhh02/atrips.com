import prisma from '../../../../config/database.js';
import { logger } from '../../../../shared/services/LoggerService.js';

class PlaceRepository {
  async findById(placeId) {
    return prisma.cached_places.findUnique({
      where: { id: placeId },
    });
  }

  async findByProviderAndExternalId(provider, externalId) {
    return prisma.cached_places.findUnique({
      where: {
        provider_externalId: { provider, externalId },
      },
    });
  }

  async upsertPlace(data) {
    return prisma.cached_places.upsert({
      where: {
        provider_externalId: {
          provider: data.provider,
          externalId: data.externalId,
        },
      },
      create: {
        ...data,
        lastFetchedAt: new Date(),
      },
      update: {
        ...data,
        lastFetchedAt: new Date(),
      },
    });
  }

  async updateEnrichedData(placeId, enrichedData, expiresAt) {
    const updateData = {
      enrichedData,
      lastFetchedAt: new Date(),
      expiresAt,
    };

    // Propagate contact info discovered during enrichment
    if (enrichedData.website) updateData.website = enrichedData.website;
    if (enrichedData.phone) updateData.phone = enrichedData.phone;

    return prisma.cached_places.update({
      where: { id: placeId },
      data: updateData,
    });
  }

  async searchNearby(query, lat, lng, radiusKm = 10) {
    const latDelta = radiusKm / 111.0;
    const lngDelta = radiusKm / (111.0 * Math.cos((lat * Math.PI) / 180));

    return prisma.cached_places.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      take: 20,
      orderBy: { rating: 'desc' },
    });
  }
}

export default new PlaceRepository();
