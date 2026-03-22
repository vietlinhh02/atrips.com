import crypto from 'node:crypto';
import prisma from '../../../../config/database.js';
import { AppError } from '../../../../shared/errors/AppError.js';
import { logger } from '../../../../shared/services/LoggerService.js';

class TripShareRepository {
  async generateShareToken(tripId, userId) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      select: { ownerId: true, shareToken: true },
    });

    if (!trip) throw AppError.notFound('Trip not found');
    if (trip.ownerId !== userId) {
      throw AppError.forbidden('Only the trip owner can share');
    }

    if (trip.shareToken) {
      return { shareToken: trip.shareToken, alreadyShared: true };
    }

    const shareToken = crypto.randomBytes(16).toString('hex');

    await prisma.$transaction(async (tx) => {
      await tx.trips.update({
        where: { id: tripId },
        data: { shareToken, visibility: 'SHARED' },
      });

      await tx.trip_shares.create({
        data: {
          tripId,
          shareToken,
          permission: 'VIEWER',
        },
      });
    });

    logger.info('[Share] Token generated', { tripId });
    return { shareToken, alreadyShared: false };
  }

  async revokeShareToken(tripId, userId) {
    const trip = await prisma.trips.findUnique({
      where: { id: tripId },
      select: { ownerId: true, shareToken: true },
    });

    if (!trip) throw AppError.notFound('Trip not found');
    if (trip.ownerId !== userId) {
      throw AppError.forbidden('Only the trip owner can revoke');
    }
    if (!trip.shareToken) {
      throw AppError.badRequest('Trip is not currently shared');
    }

    await prisma.$transaction(async (tx) => {
      await tx.trips.update({
        where: { id: tripId },
        data: { shareToken: null, visibility: 'PRIVATE' },
      });

      await tx.trip_shares.deleteMany({
        where: { tripId },
      });
    });

    logger.info('[Share] Token revoked', { tripId });
  }

  async findTripByShareToken(shareToken) {
    const trip = await prisma.trips.findFirst({
      where: { shareToken },
      include: {
        trip_cities: { orderBy: { orderIndex: 'asc' } },
        itinerary_days: {
          orderBy: { date: 'asc' },
          include: {
            activities: {
              orderBy: { orderIndex: 'asc' },
              include: {
                cached_places: true,
                image_assets: true,
              },
            },
          },
        },
      },
    });

    if (!trip) return null;

    await prisma.trip_shares.updateMany({
      where: { shareToken },
      data: {
        accessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    return trip;
  }
}

export default new TripShareRepository();
