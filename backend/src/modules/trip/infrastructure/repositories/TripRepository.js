/**
 * Trip Repository
 * Handles all database operations for trips
 * Includes caching support for frequently accessed data
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';
import { Trip } from '../../domain/entities/Trip.js';
import { AppError } from '../../../../shared/errors/AppError.js';

const CACHE_TTL = {
  TRIP_DETAIL: 1800,    // 30 minutes
  TRIP_LIST: 600,       // 10 minutes
  TRIP_SUMMARY: 1200,   // 20 minutes
};

const CACHE_KEYS = {
  TRIP_DETAIL: (id) => `trip:detail:${id}`,
  TRIP_LIST: (userId, page, filters) => `trip:list:${userId}:${page}:${JSON.stringify(filters)}`,
  USER_TRIPS: (userId) => `trip:user:${userId}:*`,
  TRIP_SUMMARY: (id) => `trip:summary:${id}`,
};

export class TripRepository {
  async getTripById(tripId, userId = null) {
    const cacheKey = CACHE_KEYS.TRIP_DETAIL(tripId);

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      if (userId && cached.owner_id !== userId) {
        const isMember = await this.#checkMembership(tripId, userId);
        if (!isMember && cached.visibility === 'PRIVATE') {
          throw AppError.forbidden('You do not have access to this trip');
        }
      }
      return Trip.fromPersistence(cached);
    }

    const record = await prisma.trip.findUnique({
      where: { id: tripId },
    });

    if (!record) {
      return null;
    }

    if (userId && record.owner_id !== userId) {
      const isMember = await this.#checkMembership(tripId, userId);
      if (!isMember && record.visibility === 'PRIVATE') {
        throw AppError.forbidden('You do not have access to this trip');
      }
    }

    await cacheService.set(cacheKey, record, CACHE_TTL.TRIP_DETAIL);
    return Trip.fromPersistence(record);
  }

  async getUserTrips(userId, filters = {}, pagination = { page: 1, limit: 10 }) {
    const { status } = filters;
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const cacheKey = CACHE_KEYS.TRIP_LIST(userId, page, filters);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const where = {
      OR: [
        { owner_id: userId },
        {
          trip_members: {
            some: {
              user_id: userId,
            },
          },
        },
      ],
    };

    if (status) {
      where.status = status;
    }

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: {
              itinerary_days: true,
              trip_members: true,
            },
          },
        },
      }),
      prisma.trip.count({ where }),
    ]);

    const result = {
      trips: trips.map(t => Trip.fromPersistence(t).toJSON()),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.TRIP_LIST);
    return result;
  }

  async getTripWithItinerary(tripId, userId = null) {
    if (userId) {
      await this.verifyTripOwnership(tripId, userId);
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        itinerary_days: {
          orderBy: { date: 'asc' },
          include: {
            activities: {
              orderBy: { order_index: 'asc' },
            },
          },
        },
        trip_members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                display_name: true,
                avatar_url: true,
              },
            },
          },
        },
        _count: {
          select: {
            ai_conversations: true,
          },
        },
      },
    });

    if (!trip) {
      throw AppError.notFound('Trip not found');
    }

    return trip;
  }

  async getTripSummary(tripId) {
    const cacheKey = CACHE_KEYS.TRIP_SUMMARY(tripId);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        title: true,
        start_date: true,
        end_date: true,
        status: true,
        travelers_count: true,
        cover_image_url: true,
        visibility: true,
      },
    });

    if (trip) {
      await cacheService.set(cacheKey, trip, CACHE_TTL.TRIP_SUMMARY);
    }

    return trip;
  }

  async createTrip(tripData, ownerId) {
    const data = {
      owner_id: ownerId,
      title: tripData.title,
      description: tripData.description,
      start_date: new Date(tripData.startDate),
      end_date: new Date(tripData.endDate),
      travelers_count: tripData.travelersCount || 1,
      budget_total: tripData.budgetTotal,
      budget_currency: tripData.budgetCurrency || 'VND',
      status: tripData.status || 'DRAFT',
      visibility: tripData.visibility || 'PRIVATE',
      cover_image_url: tripData.coverImageUrl,
      overview: tripData.overview || null, // Phase 1: Trip overview
      metadata: tripData.metadata || null, // Phase 1: Tips, budget breakdown, etc.
    };

    const trip = await prisma.trip.create({
      data,
    });

    await this.#invalidateUserCache(ownerId);
    return Trip.fromPersistence(trip);
  }

  async updateTrip(tripId, updates, userId) {
    await this.verifyTripOwnership(tripId, userId);

    const data = {};
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.startDate !== undefined) data.start_date = new Date(updates.startDate);
    if (updates.endDate !== undefined) data.end_date = new Date(updates.endDate);
    if (updates.travelersCount !== undefined) data.travelers_count = updates.travelersCount;
    if (updates.budgetTotal !== undefined) data.budget_total = updates.budgetTotal;
    if (updates.budgetCurrency !== undefined) data.budget_currency = updates.budgetCurrency;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.visibility !== undefined) data.visibility = updates.visibility;
    if (updates.coverImageUrl !== undefined) data.cover_image_url = updates.coverImageUrl;

    data.updated_at = new Date();

    const trip = await prisma.trip.update({
      where: { id: tripId },
      data,
    });

    await this.#invalidateCache(tripId, userId);
    return Trip.fromPersistence(trip);
  }

  async deleteTrip(tripId, userId) {
    await this.verifyTripOwnership(tripId, userId);

    await prisma.trip.delete({
      where: { id: tripId },
    });

    await this.#invalidateCache(tripId, userId);
  }

  async verifyTripOwnership(tripId, userId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { owner_id: true },
    });

    if (!trip) {
      throw AppError.notFound('Trip not found');
    }

    if (trip.owner_id !== userId) {
      const isMember = await this.#checkMembership(tripId, userId);
      if (!isMember) {
        throw AppError.forbidden('You do not have permission to modify this trip');
      }
    }

    return true;
  }

  /**
   * Verify user has read access to trip (owner or member or viewer)
   */
  async verifyTripAccess(tripId, userId) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      select: { owner_id: true, visibility: true },
    });

    if (!trip) {
      throw AppError.notFound('Trip not found');
    }

    // Public trips are accessible to all authenticated users
    if (trip.visibility === 'PUBLIC') {
      return true;
    }

    // Owner always has access
    if (trip.owner_id === userId) {
      return true;
    }

    // Check if user is a member or has shared access
    const isMember = await this.#checkMembership(tripId, userId);
    if (!isMember) {
      throw AppError.forbidden('You do not have access to this trip');
    }

    return true;
  }

  async getTripMembers(tripId) {
    return prisma.tripMember.findMany({
      where: { trip_id: tripId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            display_name: true,
            avatar_url: true,
            email: true,
          },
        },
      },
    });
  }

  async #checkMembership(tripId, userId) {
    const member = await prisma.tripMember.findUnique({
      where: {
        trip_id_user_id: {
          trip_id: tripId,
          user_id: userId,
        },
      },
    });
    return !!member;
  }

  async #invalidateCache(tripId, userId) {
    await cacheService.del(CACHE_KEYS.TRIP_DETAIL(tripId));
    await cacheService.del(CACHE_KEYS.TRIP_SUMMARY(tripId));
    await cacheService.deletePattern(CACHE_KEYS.USER_TRIPS(userId));
  }

  async #invalidateUserCache(userId) {
    await cacheService.deletePattern(CACHE_KEYS.USER_TRIPS(userId));
  }
}

export default new TripRepository();
