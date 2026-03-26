/**
 * Create Trip Use Case
 * Handles trip creation with validation and itinerary generation
 */

import { Trip } from '../../domain/entities/Trip.js';
import tripRepository from '../../infrastructure/repositories/TripRepository.js';
import itineraryDayRepository from '../../infrastructure/repositories/ItineraryDayRepository.js';
import tripService from '../services/TripService.js';
import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

export class CreateTripUseCase {
  async execute({
    title,
    description,
    startDate,
    endDate,
    travelersCount,
    budgetTotal,
    budgetCurrency,
    coverImageUrl,
    ownerId,
  }) {
    tripService.validateTripDates(startDate, endDate);

    if (budgetTotal !== null && budgetTotal !== undefined) {
      tripService.validateBudget(budgetTotal, budgetCurrency);
    }

    const trip = Trip.create({
      ownerId,
      title,
      description,
      startDate,
      endDate,
      travelersCount,
      budgetTotal,
      budgetCurrency,
      coverImageUrl,
    });

    const savedTrip = await tripRepository.createTrip(trip.toPersistence(), ownerId);

    await Promise.all([
      prisma.subscriptions.updateMany({
        where: { userId: ownerId },
        data: { tripsCreated: { increment: 1 } },
      }),
      cacheService.del(`user:subscription_full:${ownerId}`),
    ]);

    const days = tripService.generateItineraryDays(startDate, endDate, title);
    if (days.length > 0) {
      await itineraryDayRepository.createDays(savedTrip.id, days);
    }

    return {
      trip: savedTrip.toJSON(),
      message: 'Trip created successfully',
    };
  }
}

export default new CreateTripUseCase();
