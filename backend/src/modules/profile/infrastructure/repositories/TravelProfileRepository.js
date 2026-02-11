/**
 * Travel Profile Repository
 * Database operations for travel profiles with caching
 */

import prisma from '../../../../config/database.js';
import cacheService from '../../../../shared/services/CacheService.js';

// Cache TTL settings (in seconds)
const CACHE_TTL = {
  TRAVEL_PROFILE: 3600,     // 60 minutes
  ONBOARDING_STATUS: 7200,  // 120 minutes
};

// Cache key prefixes
const CACHE_KEYS = {
  TRAVEL_PROFILE: (userId) => `travel_profile:${userId}`,
  ONBOARDING_STATUS: (userId) => `onboarding:status:${userId}`,
};

class TravelProfileRepository {
  /**
   * Find travel profile by user ID (cached)
   */
  async findByUserId(userId) {
    const cacheKey = CACHE_KEYS.TRAVEL_PROFILE(userId);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const result = await prisma.travel_profiles.findUnique({
      where: { userId },
    });

    // Cache the result (even if null, to prevent repeated DB queries)
    await cacheService.set(cacheKey, result || null, CACHE_TTL.TRAVEL_PROFILE);

    return result;
  }

  /**
   * Create travel profile
   */
  async create(userId, data = {}) {
    const result = await prisma.travel_profiles.create({
      data: {
        userId,
        ...data,
      },
    });

    // Invalidate caches
    await this.invalidateCache(userId);

    return result;
  }

  /**
   * Update travel profile
   */
  async update(userId, data) {
    const result = await prisma.travel_profiles.update({
      where: { userId },
      data,
    });

    // Invalidate caches
    await this.invalidateCache(userId);

    return result;
  }

  /**
   * Upsert travel profile
   */
  async upsert(userId, data) {
    const result = await prisma.travel_profiles.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });

    // Invalidate caches
    await this.invalidateCache(userId);

    return result;
  }

  /**
   * Check if user needs onboarding (cached)
   */
  async needsOnboarding(userId) {
    const cacheKey = CACHE_KEYS.ONBOARDING_STATUS(userId);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const profile = await prisma.travel_profiles.findUnique({
      where: { userId },
      select: {
        completedAt: true,
        currentStep: true,
      },
    });

    let result;
    if (!profile) {
      result = {
        needsOnboarding: true,
        currentStep: 1,
        completedAt: null,
      };
    } else {
      result = {
        needsOnboarding: !profile.completedAt,
        currentStep: profile.currentStep,
        completedAt: profile.completedAt,
      };
    }

    // Cache the result
    await cacheService.set(cacheKey, result, CACHE_TTL.ONBOARDING_STATUS);

    return result;
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding(userId) {
    const result = await prisma.travel_profiles.update({
      where: { userId },
      data: {
        completedAt: new Date(),
      },
    });

    // Invalidate caches
    await this.invalidateCache(userId);

    return result;
  }

  /**
   * Invalidate all caches for a user
   */
  async invalidateCache(userId) {
    await Promise.all([
      cacheService.del(CACHE_KEYS.TRAVEL_PROFILE(userId)),
      cacheService.del(CACHE_KEYS.ONBOARDING_STATUS(userId)),
    ]);
  }
}

export default new TravelProfileRepository();
