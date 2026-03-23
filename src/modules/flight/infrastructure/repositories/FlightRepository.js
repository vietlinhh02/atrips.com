/**
 * Flight Repository
 * Handles persistence for flight searches and price trackings
 */

import prisma from '../../../../config/database.js';

class FlightRepository {
  /**
   * Save a flight search to history.
   */
  async saveSearch(userId, {
    origin,
    destination,
    departDate,
    returnDate,
    passengers = 1,
    cabinClass = 'economy',
  }) {
    return prisma.flight_searches.create({
      data: {
        userId,
        origin,
        destination,
        departDate: new Date(departDate),
        returnDate: returnDate ? new Date(returnDate) : null,
        passengers,
        cabinClass,
      },
    });
  }

  /**
   * Retrieve paginated search history for a user.
   */
  async getSearchHistory(userId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [searches, total] = await prisma.$transaction([
      prisma.flight_searches.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.flight_searches.count({ where: { userId } }),
    ]);

    return { searches, pagination: { page, limit, total } };
  }

  /**
   * Create a new price tracking entry.
   */
  async createTracking(userId, {
    origin,
    destination,
    departDate,
    returnDate,
    priceThreshold,
    currency = 'USD',
  }) {
    return prisma.flight_trackings.create({
      data: {
        userId,
        origin,
        destination,
        departDate: new Date(departDate),
        returnDate: returnDate ? new Date(returnDate) : null,
        priceThreshold: priceThreshold ?? null,
        currency,
      },
    });
  }

  /**
   * Retrieve paginated active trackings for a user.
   */
  async getUserTrackings(userId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [trackings, total] = await prisma.$transaction([
      prisma.flight_trackings.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.flight_trackings.count({
        where: { userId, isActive: true },
      }),
    ]);

    return { trackings, pagination: { page, limit, total } };
  }

  /**
   * Update the last-checked price for a tracking.
   */
  async updateTrackingPrice(trackingId, price) {
    return prisma.flight_trackings.update({
      where: { id: trackingId },
      data: {
        lastPrice: price,
        lastCheckedAt: new Date(),
      },
    });
  }

  /**
   * Delete a tracking, verifying the caller owns it.
   */
  async deleteTracking(trackingId, userId) {
    return prisma.flight_trackings.deleteMany({
      where: { id: trackingId, userId },
    });
  }

  /**
   * Deactivate a tracking, verifying the caller owns it.
   */
  async deactivateTracking(trackingId, userId) {
    return prisma.flight_trackings.updateMany({
      where: { id: trackingId, userId },
      data: { isActive: false },
    });
  }
}

export default new FlightRepository();
