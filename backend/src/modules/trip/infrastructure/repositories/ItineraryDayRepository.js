/**
 * Itinerary Day Repository
 * Handles database operations for itinerary days
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

const CACHE_KEYS = {
  TRIP_DAYS: (tripId) => `trip:${tripId}:days`,
};

export class ItineraryDayRepository {
  async createDay(tripId, dayData) {
    const day = await prisma.itineraryDay.create({
      data: {
        trip_id: tripId,
        date: new Date(dayData.date),
        day_number: dayData.dayNumber,
        title: dayData.title,
        notes: dayData.notes,
      },
    });

    await cacheService.del(CACHE_KEYS.TRIP_DAYS(tripId));
    await cacheService.del(`trip:detail:${tripId}`);

    return day;
  }

  async createDays(tripId, daysData) {
    const days = await prisma.itineraryDay.createMany({
      data: daysData.map(dayData => ({
        trip_id: tripId,
        date: new Date(dayData.date),
        day_number: dayData.dayNumber,
        title: dayData.title,
        notes: dayData.notes,
      })),
    });

    await cacheService.del(CACHE_KEYS.TRIP_DAYS(tripId));
    await cacheService.del(`trip:detail:${tripId}`);

    return days;
  }

  async getDaysByTrip(tripId) {
    const cacheKey = CACHE_KEYS.TRIP_DAYS(tripId);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const days = await prisma.itineraryDay.findMany({
      where: { trip_id: tripId },
      orderBy: { date: 'asc' },
      include: {
        activities: {
          orderBy: { order_index: 'asc' },
        },
      },
    });

    await cacheService.set(cacheKey, days, 1800);
    return days;
  }

  async updateDay(dayId, updates) {
    const data = {};
    if (updates.date !== undefined) data.date = new Date(updates.date);
    if (updates.dayNumber !== undefined) data.day_number = updates.dayNumber;
    if (updates.title !== undefined) data.title = updates.title;
    if (updates.notes !== undefined) data.notes = updates.notes;

    data.updated_at = new Date();

    const day = await prisma.itineraryDay.update({
      where: { id: dayId },
      data,
    });

    const tripDay = await prisma.itineraryDay.findUnique({
      where: { id: dayId },
      select: { trip_id: true },
    });

    if (tripDay) {
      await cacheService.del(CACHE_KEYS.TRIP_DAYS(tripDay.trip_id));
      await cacheService.del(`trip:detail:${tripDay.trip_id}`);
    }

    return day;
  }

  async deleteDay(dayId) {
    const day = await prisma.itineraryDay.findUnique({
      where: { id: dayId },
      select: { trip_id: true },
    });

    await prisma.itineraryDay.delete({
      where: { id: dayId },
    });

    if (day) {
      await cacheService.del(CACHE_KEYS.TRIP_DAYS(day.trip_id));
      await cacheService.del(`trip:detail:${day.trip_id}`);
    }
  }

  async getDayById(dayId) {
    return prisma.itineraryDay.findUnique({
      where: { id: dayId },
      include: {
        activities: {
          orderBy: { order_index: 'asc' },
        },
      },
    });
  }
}

export default new ItineraryDayRepository();
