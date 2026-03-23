import crypto from 'node:crypto';
import prisma from '../../../../config/database.js';
import { AppError } from '../../../../shared/errors/AppError.js';

const ARCHIVABLE_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED'];

export class TripAdvancedRepository {
  async duplicateTrip(tripId, userId) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      include: {
        trip_cities: { orderBy: { orderIndex: 'asc' } },
        itinerary_days: {
          orderBy: { date: 'asc' },
          include: {
            activities: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    });

    if (!trip) {
      throw AppError.notFound('Trip not found');
    }

    if (trip.ownerId !== userId) {
      throw AppError.forbidden(
        'You do not have permission to duplicate this trip'
      );
    }

    const newTripId = crypto.randomUUID();

    return prisma.$transaction(async (tx) => {
      const newTrip = await tx.trips.create({
        data: {
          id: newTripId,
          ownerId: userId,
          title: `${trip.title} (Copy)`,
          description: trip.description,
          coverImageUrl: trip.coverImageUrl,
          startDate: trip.startDate,
          endDate: trip.endDate,
          travelersCount: trip.travelersCount,
          budgetTotal: trip.budgetTotal,
          budgetCurrency: trip.budgetCurrency,
          status: 'DRAFT',
          visibility: 'PRIVATE',
          overview: trip.overview,
          metadata: trip.metadata,
        },
      });

      if (trip.trip_cities.length > 0) {
        await tx.trip_cities.createMany({
          data: trip.trip_cities.map((city) => ({
            id: crypto.randomUUID(),
            tripId: newTripId,
            cityName: city.cityName,
            countryCode: city.countryCode,
            latitude: city.latitude,
            longitude: city.longitude,
            placeId: city.placeId,
            startDate: city.startDate,
            endDate: city.endDate,
            orderIndex: city.orderIndex,
          })),
        });
      }

      for (const day of trip.itinerary_days) {
        const newDayId = crypto.randomUUID();

        await tx.itinerary_days.create({
          data: {
            id: newDayId,
            tripId: newTripId,
            date: day.date,
            cityName: day.cityName,
            dayNumber: day.dayNumber,
            notes: day.notes,
            weatherData: day.weatherData,
            metadata: day.metadata,
          },
        });

        if (day.activities.length > 0) {
          await tx.activities.createMany({
            data: day.activities.map((activity) => ({
              id: crypto.randomUUID(),
              itineraryDayId: newDayId,
              name: activity.name,
              type: activity.type,
              description: activity.description,
              startTime: activity.startTime,
              endTime: activity.endTime,
              duration: activity.duration,
              placeId: activity.placeId,
              customAddress: activity.customAddress,
              latitude: activity.latitude,
              longitude: activity.longitude,
              estimatedCost: activity.estimatedCost,
              currency: activity.currency,
              bookingUrl: activity.bookingUrl,
              notes: activity.notes,
              orderIndex: activity.orderIndex,
              transportFromPrevious: activity.transportFromPrevious,
              imageAssetId: activity.imageAssetId,
            })),
          });
        }
      }

      return tx.trips.findUnique({
        where: { id: newTrip.id },
        include: {
          trip_cities: { orderBy: { orderIndex: 'asc' } },
          itinerary_days: {
            orderBy: { date: 'asc' },
            include: {
              activities: { orderBy: { orderIndex: 'asc' } },
            },
          },
        },
      });
    });
  }

  async archiveTrip(tripId, userId) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      select: { ownerId: true, status: true },
    });

    if (!trip) {
      throw AppError.notFound('Trip not found');
    }

    if (trip.ownerId !== userId) {
      throw AppError.forbidden(
        'You do not have permission to archive this trip'
      );
    }

    if (!ARCHIVABLE_STATUSES.includes(trip.status)) {
      throw AppError.badRequest(
        `Cannot archive a trip with status "${trip.status}". ` +
          `Allowed statuses: ${ARCHIVABLE_STATUSES.join(', ')}`
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.trips.update({
        where: { id: tripId },
        data: { status: 'ARCHIVED' },
      });

      await tx.trip_status_history.create({
        data: {
          tripId,
          status: 'ARCHIVED',
          changedBy: userId,
        },
      });

      return updated;
    });
  }

  async restoreTrip(tripId, userId) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      select: { ownerId: true, status: true },
    });

    if (!trip) {
      throw AppError.notFound('Trip not found');
    }

    if (trip.ownerId !== userId) {
      throw AppError.forbidden(
        'You do not have permission to restore this trip'
      );
    }

    if (trip.status !== 'ARCHIVED') {
      throw AppError.badRequest(
        `Cannot restore a trip with status "${trip.status}". ` +
          'Only ARCHIVED trips can be restored'
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.trips.update({
        where: { id: tripId },
        data: { status: 'DRAFT' },
      });

      await tx.trip_status_history.create({
        data: {
          tripId,
          status: 'DRAFT',
          changedBy: userId,
        },
      });

      return updated;
    });
  }

  async duplicateTripByData(tripData, newOwnerId) {
    const newTripId = crypto.randomUUID();

    return prisma.$transaction(async (tx) => {
      const newTrip = await tx.trips.create({
        data: {
          id: newTripId,
          ownerId: newOwnerId,
          title: `${tripData.title} (Copy)`,
          description: tripData.description,
          coverImageUrl: tripData.coverImageUrl,
          startDate: tripData.startDate,
          endDate: tripData.endDate,
          travelersCount: tripData.travelersCount,
          budgetTotal: tripData.budgetTotal,
          budgetCurrency: tripData.budgetCurrency,
          status: 'DRAFT',
          visibility: 'PRIVATE',
          overview: tripData.overview,
          metadata: tripData.metadata,
        },
      });

      if (tripData.trip_cities?.length > 0) {
        await tx.trip_cities.createMany({
          data: tripData.trip_cities.map((city) => ({
            id: crypto.randomUUID(),
            tripId: newTripId,
            cityName: city.cityName,
            countryCode: city.countryCode,
            latitude: city.latitude,
            longitude: city.longitude,
            placeId: city.placeId,
            startDate: city.startDate,
            endDate: city.endDate,
            orderIndex: city.orderIndex,
          })),
        });
      }

      for (const day of tripData.itinerary_days || []) {
        const newDayId = crypto.randomUUID();

        await tx.itinerary_days.create({
          data: {
            id: newDayId,
            tripId: newTripId,
            date: day.date,
            cityName: day.cityName,
            dayNumber: day.dayNumber,
            notes: day.notes,
            weatherData: day.weatherData,
            metadata: day.metadata,
          },
        });

        if (day.activities?.length > 0) {
          await tx.activities.createMany({
            data: day.activities.map((a) => ({
              id: crypto.randomUUID(),
              itineraryDayId: newDayId,
              name: a.name,
              type: a.type,
              description: a.description,
              startTime: a.startTime,
              endTime: a.endTime,
              duration: a.duration,
              placeId: a.placeId,
              customAddress: a.customAddress,
              latitude: a.latitude,
              longitude: a.longitude,
              estimatedCost: a.estimatedCost,
              currency: a.currency,
              bookingUrl: a.bookingUrl,
              notes: a.notes,
              orderIndex: a.orderIndex,
              transportFromPrevious: a.transportFromPrevious,
              imageAssetId: a.imageAssetId,
            })),
          });
        }
      }

      return tx.trips.findUnique({
        where: { id: newTrip.id },
        include: {
          trip_cities: { orderBy: { orderIndex: 'asc' } },
          itinerary_days: {
            orderBy: { date: 'asc' },
            include: {
              activities: { orderBy: { orderIndex: 'asc' } },
            },
          },
        },
      });
    });
  }

  async getStatusHistory(tripId) {
    return prisma.trip_status_history.findMany({
      where: { tripId },
      orderBy: { changedAt: 'desc' },
    });
  }

  async createExportRecord(tripId, exportType, fileUrl, expiresAt) {
    return prisma.trip_exports.create({
      data: {
        tripId,
        exportType,
        fileUrl: fileUrl ?? null,
        expiresAt: expiresAt ?? null,
      },
    });
  }

  async getExports(tripId) {
    return prisma.trip_exports.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTripForExport(tripId) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      include: {
        trip_cities: { orderBy: { orderIndex: 'asc' } },
        itinerary_days: {
          orderBy: { date: 'asc' },
          include: {
            activities: { orderBy: { orderIndex: 'asc' } },
          },
        },
      },
    });

    if (!trip) {
      throw AppError.notFound('Trip not found');
    }

    return trip;
  }
}

export default new TripAdvancedRepository();
