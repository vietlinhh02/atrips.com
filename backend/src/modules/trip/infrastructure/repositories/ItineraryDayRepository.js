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
    const day = await prisma.itinerary_days.create({
      data: {
        tripId: tripId,
        date: new Date(dayData.date),
        dayNumber: dayData.dayNumber,
        notes: dayData.notes,
        cityName: dayData.cityName || null,
        weatherData: dayData.weatherData || null,
        metadata: dayData.metadata || null,
      },
    });

    await cacheService.del(CACHE_KEYS.TRIP_DAYS(tripId));
    await cacheService.del(`trip:detail:${tripId}`);

    return day;
  }

  async createDays(tripId, daysData) {
    const days = await prisma.itinerary_days.createMany({
      data: daysData.map(dayData => ({
        tripId: tripId,
        date: new Date(dayData.date),
        dayNumber: dayData.dayNumber,
        notes: dayData.notes,
        cityName: dayData.cityName || null,
        weatherData: dayData.weatherData || null,
        metadata: dayData.metadata || null,
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

    const days = await prisma.itinerary_days.findMany({
      where: { tripId: tripId },
      orderBy: { date: 'asc' },
      include: {
        activities: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    await cacheService.set(cacheKey, days, 1800);
    return days;
  }

  async updateDay(dayId, updates) {
    const data = {};
    if (updates.date !== undefined) data.date = new Date(updates.date);
    if (updates.dayNumber !== undefined) data.dayNumber = updates.dayNumber;
    if (updates.notes !== undefined) data.notes = updates.notes;
    if (updates.cityName !== undefined) data.cityName = updates.cityName;
    if (updates.weatherData !== undefined) data.weatherData = updates.weatherData;
    if (updates.metadata !== undefined) data.metadata = updates.metadata;

    const day = await prisma.itinerary_days.update({
      where: { id: dayId },
      data,
    });

    const tripDay = await prisma.itinerary_days.findUnique({
      where: { id: dayId },
      select: { tripId: true },
    });

    if (tripDay) {
      await cacheService.del(CACHE_KEYS.TRIP_DAYS(tripDay.tripId));
      await cacheService.del(`trip:detail:${tripDay.tripId}`);
    }

    return day;
  }

  async deleteDay(dayId) {
    const day = await prisma.itinerary_days.findUnique({
      where: { id: dayId },
      select: { tripId: true },
    });

    await prisma.itinerary_days.delete({
      where: { id: dayId },
    });

    if (day) {
      await cacheService.del(CACHE_KEYS.TRIP_DAYS(day.tripId));
      await cacheService.del(`trip:detail:${day.tripId}`);
    }
  }

  async getDayById(dayId) {
    return prisma.itinerary_days.findUnique({
      where: { id: dayId },
      include: {
        activities: {
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
  }
}

export default new ItineraryDayRepository();
