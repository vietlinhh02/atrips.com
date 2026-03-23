/**
 * Activity Repository
 * Handles database operations for activities
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

/**
 * Convert time string "HH:MM" or "HH:MM:SS" to a Date object for Prisma @db.Time fields.
 */
function parseTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(String(value))) {
    return new Date(`1970-01-01T${value}:00.000Z`);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export class ActivityRepository {
  async create(activityData) {
    const data = {
      itineraryDayId: activityData.itineraryDayId,
      name: activityData.name,
      type: activityData.type || 'OTHER',
      description: activityData.description,
      startTime: parseTime(activityData.startTime),
      endTime: parseTime(activityData.endTime),
      duration: activityData.duration,
      placeId: activityData.placeId,
      customAddress: activityData.customAddress,
      latitude: activityData.latitude,
      longitude: activityData.longitude,
      estimatedCost: activityData.estimatedCost,
      currency: activityData.currency || 'VND',
      bookingUrl: activityData.bookingUrl || null,
      bookingConfirmation: activityData.bookingConfirmation || null,
      notes: activityData.notes,
      orderIndex: activityData.orderIndex || 0,
      transportFromPrevious: activityData.transportFromPrevious || null,
      createdById: activityData.createdById,
      imageAssetId: activityData.imageAssetId || null,
    };

    const activity = await prisma.activities.create({
      data,
    });

    await this.#invalidateCache(activityData.itineraryDayId);

    return activity;
  }

  async update(activityId, updates) {
    const data = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.startTime !== undefined) data.startTime = parseTime(updates.startTime);
    if (updates.endTime !== undefined) data.endTime = parseTime(updates.endTime);
    if (updates.duration !== undefined) data.duration = updates.duration;
    if (updates.placeId !== undefined) data.placeId = updates.placeId;
    if (updates.customAddress !== undefined) data.customAddress = updates.customAddress;
    if (updates.latitude !== undefined) data.latitude = updates.latitude;
    if (updates.longitude !== undefined) data.longitude = updates.longitude;
    if (updates.estimatedCost !== undefined) data.estimatedCost = updates.estimatedCost;
    if (updates.currency !== undefined) data.currency = updates.currency;
    if (updates.bookingUrl !== undefined) data.bookingUrl = updates.bookingUrl;
    if (updates.bookingConfirmation !== undefined) data.bookingConfirmation = updates.bookingConfirmation;
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.orderIndex !== undefined) data.orderIndex = updates.orderIndex;
    if (updates.transportFromPrevious !== undefined) data.transportFromPrevious = updates.transportFromPrevious;
    if (updates.imageAssetId !== undefined) data.imageAssetId = updates.imageAssetId;

    const activity = await prisma.activities.update({
      where: { id: activityId },
      data,
    });

    await this.#invalidateCache(activity.itineraryDayId);

    return activity;
  }

  async delete(activityId) {
    const activity = await prisma.activities.findUnique({
      where: { id: activityId },
      select: { itineraryDayId: true },
    });

    await prisma.activities.delete({
      where: { id: activityId },
    });

    if (activity) {
      await this.#invalidateCache(activity.itineraryDayId);
    }
  }

  async deleteMany(activityIds) {
    const activities = await prisma.activities.findMany({
      where: { id: { in: activityIds } },
      select: { itineraryDayId: true },
    });

    await prisma.activities.deleteMany({
      where: { id: { in: activityIds } },
    });

    const dayIds = [...new Set(activities.map(a => a.itineraryDayId))];
    for (const dayId of dayIds) {
      await this.#invalidateCache(dayId);
    }
  }

  async reorder(dayId, activityIds) {
    const updates = activityIds.map((activityId, index) =>
      prisma.activities.update({
        where: { id: activityId },
        data: { orderIndex: index },
      })
    );

    await prisma.$transaction(updates);
    await this.#invalidateCache(dayId);
  }

  async getByDay(dayId) {
    return prisma.activities.findMany({
      where: { itineraryDayId: dayId },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async searchByPlace(placeId) {
    return prisma.activities.findMany({
      where: { placeId: placeId },
      include: {
        itinerary_days: {
          include: {
            trips: {
              select: {
                id: true,
                title: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });
  }

  async getById(activityId) {
    return prisma.activities.findUnique({
      where: { id: activityId },
    });
  }

  async #invalidateCache(dayId) {
    const day = await prisma.itinerary_days.findUnique({
      where: { id: dayId },
      select: { tripId: true },
    });

    if (day) {
      await cacheService.del(`trip:${day.tripId}:days`);
      await cacheService.del(`trip:detail:${day.tripId}`);
    }
  }
}

export default new ActivityRepository();
