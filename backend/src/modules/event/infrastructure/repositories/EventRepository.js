/**
 * Event Repository
 * Handles caching and retrieval of local event data
 */

import prisma from '../../../../config/database.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const KM_PER_DEGREE_LAT = 111;

class EventRepository {
  /**
   * Search cached (non-expired) events by city and date range.
   */
  async searchCached(city, startDate, endDate, {
    category,
    page = 1,
    limit = 20,
  } = {}) {
    const where = {
      city: { equals: city, mode: 'insensitive' },
      startTime: { gte: new Date(startDate) },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    if (endDate) {
      where.startTime.lte = new Date(endDate);
    }
    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      prisma.local_events.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.local_events.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Upsert an array of events with a 24-hour TTL.
   * Deduplicates by externalId + provider using find-then-update/create
   * since the schema has no unique constraint on those fields.
   */
  async cacheEvents(events) {
    if (!Array.isArray(events) || events.length === 0) return;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

    for (const e of events) {
      const data = {
        externalId: e.externalId,
        provider: e.provider,
        title: e.title,
        description: e.description,
        startTime: e.startTime,
        endTime: e.endTime,
        venue: e.venue,
        address: e.address,
        city: e.city,
        countryCode: e.countryCode,
        latitude: e.latitude,
        longitude: e.longitude,
        category: e.category,
        ticketUrl: e.ticketUrl,
        priceRange: e.priceRange,
        imageUrl: e.imageUrl,
        fetchedAt: now,
        expiresAt,
      };

      if (e.externalId && e.provider) {
        const existing = await prisma.local_events.findFirst({
          where: {
            externalId: e.externalId,
            provider: e.provider,
          },
          select: { id: true },
        });

        if (existing) {
          await prisma.local_events.update({
            where: { id: existing.id },
            data,
          });
          continue;
        }
      }

      await prisma.local_events.create({ data });
    }
  }

  /**
   * Find a single event by ID.
   */
  async findById(id) {
    return prisma.local_events.findUnique({ where: { id } });
  }

  /**
   * Search events by geographic proximity using a bounding box.
   * radiusKm is converted to approximate lat/lng offsets.
   */
  async searchByLocation(latitude, longitude, radiusKm, {
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = {}) {
    const latDelta = radiusKm / KM_PER_DEGREE_LAT;
    const lngDelta = radiusKm
      / (KM_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180));

    const where = {
      latitude: {
        gte: latitude - latDelta,
        lte: latitude + latDelta,
      },
      longitude: {
        gte: longitude - lngDelta,
        lte: longitude + lngDelta,
      },
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    if (startDate) {
      where.startTime = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.startTime = {
        ...(where.startTime || {}),
        lte: new Date(endDate),
      };
    }

    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      prisma.local_events.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.local_events.count({ where }),
    ]);

    return { events, total };
  }

  /**
   * Delete all expired event rows.
   * @returns {number} Number of deleted rows.
   */
  async cleanExpired() {
    const result = await prisma.local_events.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }
}

export default new EventRepository();
