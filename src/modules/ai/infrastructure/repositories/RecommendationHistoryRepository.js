/**
 * Recommendation History Repository
 * Tracks which places have been recommended to each user
 * for diversity scoring in POIRecommender.
 */

import prisma from '../../../../config/database.js';
import { generatePlaceKey } from '../../domain/algorithms/POIRecommender.js';
import { logger } from '../../../../shared/services/LoggerService.js';

const HISTORY_TTL_DAYS = 90;

class RecommendationHistoryRepository {
  /**
   * Get previously recommended places for a user+destination.
   * Returns Map<placeKey, Date> filtered to last 90 days.
   */
  async getByUserAndDestination(userId, destination) {
    if (!userId || !destination) return new Map();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_TTL_DAYS);

    const rows = await prisma.recommendation_history.findMany({
      where: {
        userId,
        destination,
        recommendedAt: { gte: cutoff },
      },
      select: { placeKey: true, recommendedAt: true },
      orderBy: { recommendedAt: 'desc' },
    });

    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.placeKey)) {
        map.set(row.placeKey, row.recommendedAt);
      }
    }
    return map;
  }

  /**
   * Record recommended places from a completed draft.
   * Appends one row per activity (no upsert).
   */
  async recordRecommendations(
    userId, destination, activities, draftId,
  ) {
    if (!userId || !destination || !activities?.length) return;

    const data = activities
      .filter(a => a.name || a.title)
      .map(a => ({
        userId,
        placeKey: generatePlaceKey(a, destination),
        destination,
        placeName: (a.name || a.title || '').slice(0, 255),
        draftId: draftId || null,
      }));

    if (data.length === 0) return;

    try {
      await prisma.recommendation_history.createMany({
        data,
        skipDuplicates: false,
      });
    } catch (error) {
      logger.warn('[RecommendationHistory] Failed to record:', {
        error: error.message,
        count: data.length,
      });
    }
  }

  /**
   * Delete records older than TTL. Call from a periodic job.
   */
  async cleanup() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - HISTORY_TTL_DAYS);

    const { count } = await prisma.recommendation_history.deleteMany({
      where: { recommendedAt: { lt: cutoff } },
    });
    return count;
  }
}

export default new RecommendationHistoryRepository();
