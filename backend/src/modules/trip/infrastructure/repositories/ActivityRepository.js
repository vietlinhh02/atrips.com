/**
 * Activity Repository
 * Handles database operations for activities
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

export class ActivityRepository {
  async create(activityData) {
    const data = {
      itinerary_day_id: activityData.itineraryDayId,
      name: activityData.name,
      type: activityData.type || 'OTHER',
      description: activityData.description,
      start_time: activityData.startTime,
      end_time: activityData.endTime,
      duration: activityData.duration,
      place_id: activityData.placeId,
      place_name: activityData.placeName,
      custom_address: activityData.customAddress,
      latitude: activityData.latitude,
      longitude: activityData.longitude,
      estimated_cost: activityData.estimatedCost,
      actual_cost: activityData.actualCost,
      notes: activityData.notes,
      order_index: activityData.orderIndex || 0,
      transport_from_previous: activityData.transportFromPrevious || null, // Phase 1
      created_by_id: activityData.createdById,
    };

    const activity = await prisma.activity.create({
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
    if (updates.startTime !== undefined) data.start_time = updates.startTime;
    if (updates.endTime !== undefined) data.end_time = updates.endTime;
    if (updates.duration !== undefined) data.duration = updates.duration;
    if (updates.placeId !== undefined) data.place_id = updates.placeId;
    if (updates.placeName !== undefined) data.place_name = updates.placeName;
    if (updates.customAddress !== undefined) data.custom_address = updates.customAddress;
    if (updates.latitude !== undefined) data.latitude = updates.latitude;
    if (updates.longitude !== undefined) data.longitude = updates.longitude;
    if (updates.estimatedCost !== undefined) data.estimated_cost = updates.estimatedCost;
    if (updates.actualCost !== undefined) data.actual_cost = updates.actualCost;
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.orderIndex !== undefined) data.order_index = updates.orderIndex;

    data.updated_at = new Date();

    const activity = await prisma.activity.update({
      where: { id: activityId },
      data,
    });

    await this.#invalidateCache(activity.itinerary_day_id);

    return activity;
  }

  async delete(activityId) {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { itinerary_day_id: true },
    });

    await prisma.activity.delete({
      where: { id: activityId },
    });

    if (activity) {
      await this.#invalidateCache(activity.itinerary_day_id);
    }
  }

  async deleteMany(activityIds) {
    const activities = await prisma.activity.findMany({
      where: { id: { in: activityIds } },
      select: { itinerary_day_id: true },
    });

    await prisma.activity.deleteMany({
      where: { id: { in: activityIds } },
    });

    const dayIds = [...new Set(activities.map(a => a.itinerary_day_id))];
    for (const dayId of dayIds) {
      await this.#invalidateCache(dayId);
    }
  }

  async reorder(dayId, activityIds) {
    const updates = activityIds.map((activityId, index) =>
      prisma.activity.update({
        where: { id: activityId },
        data: { order_index: index },
      })
    );

    await prisma.$transaction(updates);
    await this.#invalidateCache(dayId);
  }

  async getByDay(dayId) {
    return prisma.activity.findMany({
      where: { itinerary_day_id: dayId },
      orderBy: { order_index: 'asc' },
    });
  }

  async searchByPlace(placeId) {
    return prisma.activity.findMany({
      where: { place_id: placeId },
      include: {
        itinerary_day: {
          include: {
            trip: {
              select: {
                id: true,
                title: true,
                owner_id: true,
              },
            },
          },
        },
      },
    });
  }

  async getById(activityId) {
    return prisma.activity.findUnique({
      where: { id: activityId },
    });
  }

  async #invalidateCache(dayId) {
    const day = await prisma.itineraryDay.findUnique({
      where: { id: dayId },
      select: { trip_id: true },
    });

    if (day) {
      await cacheService.del(`trip:${day.trip_id}:days`);
      await cacheService.del(`trip:detail:${day.trip_id}`);
    }
  }
}

export default new ActivityRepository();
