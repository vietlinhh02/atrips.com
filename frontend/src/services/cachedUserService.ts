/**
 * Cached User Service
 *
 * Wrapper around userService with automatic caching.
 * Provides optimistic updates and cache invalidation.
 */

import userService, {
  UserProfile,
  UpdateProfileData,
  UserPreferences,
  ChangePasswordData,
  UserSubscription,
  CheckoutSession,
  UserStats,
} from './userService';
import { cacheService } from '../lib/cache/cacheService';
import { CacheTTL, CacheNamespace } from '../lib/cache/types';

// ============================================================
// Cache Keys
// ============================================================

const CacheKeys = {
  PROFILE: (userId?: string) => userId ? `profile:${userId}` : 'profile:current',
  PREFERENCES: (userId?: string) => userId ? `preferences:${userId}` : 'preferences:current',
  SUBSCRIPTION: (userId?: string) => userId ? `subscription:${userId}` : 'subscription:current',
  STATS: (userId?: string) => userId ? `stats:${userId}` : 'stats:current',
  FEATURE_ACCESS: (feature: string) => `feature:${feature}`,
} as const;

// ============================================================
// Cached User Service
// ============================================================

class CachedUserService {
  /**
   * Get user profile with caching
   */
  async getProfile(userId?: string): Promise<UserProfile> {
    const cacheKey = CacheKeys.PROFILE(userId);

    // Try cache first
    const cached = cacheService.get<UserProfile>(cacheKey, {
      namespace: CacheNamespace.USERS,
      storage: 'memory',
    });

    if (cached) {
      return cached;
    }

    // Fetch from API
    const profile = await userService.getProfile();

    // Cache the result
    cacheService.set(cacheKey, profile, {
      namespace: CacheNamespace.USERS,
      ttl: CacheTTL.MEDIUM,
      storage: 'localStorage',
      tags: ['user', userId ? `user:${userId}` : 'user:current'],
    });

    return profile;
  }

  /**
   * Update user profile with optimistic update
   */
  async updateProfile(
    data: UpdateProfileData,
    currentProfile?: UserProfile
  ): Promise<UserProfile> {
    const cacheKey = CacheKeys.PROFILE();

    // Optimistic update if we have current data
    if (currentProfile) {
      const optimisticProfile: UserProfile = {
        ...currentProfile,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      cacheService.set(cacheKey, optimisticProfile, {
        namespace: CacheNamespace.USERS,
        ttl: CacheTTL.SHORT,
        storage: 'memory',
      });
    }

    try {
      // Make API call
      const updatedProfile = await userService.updateProfile(data);

      // Update cache with actual data
      cacheService.set(cacheKey, updatedProfile, {
        namespace: CacheNamespace.USERS,
        ttl: CacheTTL.MEDIUM,
        storage: 'localStorage',
        tags: ['user', 'user:current'],
      });

      return updatedProfile;
    } catch (error) {
      // Revert optimistic update on error
      if (currentProfile) {
        cacheService.set(cacheKey, currentProfile, {
          namespace: CacheNamespace.USERS,
          ttl: CacheTTL.MEDIUM,
          storage: 'localStorage',
        });
      }
      throw error;
    }
  }

  /**
   * Get user preferences with caching
   */
  async getPreferences(userId?: string): Promise<UserPreferences> {
    const cacheKey = CacheKeys.PREFERENCES(userId);

    // Try cache first
    const cached = cacheService.get<UserPreferences>(cacheKey, {
      namespace: CacheNamespace.SETTINGS,
      storage: 'localStorage',
    });

    if (cached) {
      return cached;
    }

    // Fetch from API
    const preferences = await userService.getPreferences();

    // Cache the result
    cacheService.set(cacheKey, preferences, {
      namespace: CacheNamespace.SETTINGS,
      ttl: CacheTTL.LONG,
      storage: 'localStorage',
      tags: ['preferences', userId ? `user:${userId}` : 'user:current'],
    });

    return preferences;
  }

  /**
   * Update user preferences with optimistic update
   */
  async updatePreferences(
    data: Partial<UserPreferences>,
    currentPreferences?: UserPreferences
  ): Promise<UserPreferences> {
    const cacheKey = CacheKeys.PREFERENCES();

    // Optimistic update
    if (currentPreferences) {
      const optimisticPreferences: UserPreferences = {
        ...currentPreferences,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      cacheService.set(cacheKey, optimisticPreferences, {
        namespace: CacheNamespace.SETTINGS,
        ttl: CacheTTL.SHORT,
        storage: 'localStorage',
      });
    }

    try {
      const updatedPreferences = await userService.updatePreferences(data);

      cacheService.set(cacheKey, updatedPreferences, {
        namespace: CacheNamespace.SETTINGS,
        ttl: CacheTTL.LONG,
        storage: 'localStorage',
        tags: ['preferences', 'user:current'],
      });

      return updatedPreferences;
    } catch (error) {
      if (currentPreferences) {
        cacheService.set(cacheKey, currentPreferences, {
          namespace: CacheNamespace.SETTINGS,
          ttl: CacheTTL.LONG,
          storage: 'localStorage',
        });
      }
      throw error;
    }
  }

  /**
   * Change password (no caching, just invalidation)
   */
  async changePassword(data: ChangePasswordData): Promise<{ message: string }> {
    const result = await userService.changePassword(data);

    // Invalidate auth-related caches for security
    cacheService.clear(CacheNamespace.AUTH);

    return result;
  }

  /**
   * Get subscription info with caching
   */
  async getSubscription(userId?: string): Promise<UserSubscription> {
    const cacheKey = CacheKeys.SUBSCRIPTION(userId);

    // Try cache first (short TTL for subscription as it can change)
    const cached = cacheService.get<UserSubscription>(cacheKey, {
      namespace: CacheNamespace.USERS,
      storage: 'memory',
    });

    if (cached) {
      return cached;
    }

    // Fetch from API
    const subscription = await userService.getSubscription();

    // Cache with shorter TTL
    cacheService.set(cacheKey, subscription, {
      namespace: CacheNamespace.USERS,
      ttl: CacheTTL.SHORT,
      storage: 'memory',
      tags: ['subscription', userId ? `user:${userId}` : 'user:current'],
    });

    return subscription;
  }

  /**
   * Create checkout session (no caching)
   */
  async createCheckoutSession(tier: 'PRO' | 'BUSINESS'): Promise<CheckoutSession> {
    return userService.createCheckoutSession(tier);
  }

  /**
   * Check feature access with caching
   */
  async checkFeatureAccess(feature: string): Promise<boolean> {
    const cacheKey = CacheKeys.FEATURE_ACCESS(feature);

    // Try cache first
    const cached = cacheService.get<boolean>(cacheKey, {
      namespace: CacheNamespace.USERS,
      storage: 'memory',
    });

    if (cached !== null) {
      return cached;
    }

    // Fetch from API
    const hasAccess = await userService.checkFeatureAccess(feature);

    // Cache with medium TTL
    cacheService.set(cacheKey, hasAccess, {
      namespace: CacheNamespace.USERS,
      ttl: CacheTTL.MEDIUM,
      storage: 'memory',
      tags: ['feature', 'user:current'],
    });

    return hasAccess;
  }

  /**
   * Get user stats with caching
   */
  async getStats(userId?: string): Promise<UserStats> {
    const cacheKey = CacheKeys.STATS(userId);

    // Try cache first
    const cached = cacheService.get<UserStats>(cacheKey, {
      namespace: CacheNamespace.USERS,
      storage: 'memory',
    });

    if (cached) {
      return cached;
    }

    // Fetch from API
    const stats = await userService.getStats();

    // Cache with short TTL (stats change frequently)
    cacheService.set(cacheKey, stats, {
      namespace: CacheNamespace.USERS,
      ttl: CacheTTL.SHORT,
      storage: 'memory',
      tags: ['stats', userId ? `user:${userId}` : 'user:current'],
    });

    return stats;
  }

  // ============================================================
  // Cache Management
  // ============================================================

  /**
   * Invalidate all user caches
   */
  invalidateUserCaches(userId?: string): void {
    const tag = userId ? `user:${userId}` : 'user:current';
    cacheService.deleteByTag(tag);
  }

  /**
   * Invalidate profile cache
   */
  invalidateProfile(userId?: string): void {
    cacheService.delete(CacheKeys.PROFILE(userId), CacheNamespace.USERS);
  }

  /**
   * Invalidate preferences cache
   */
  invalidatePreferences(userId?: string): void {
    cacheService.delete(CacheKeys.PREFERENCES(userId), CacheNamespace.SETTINGS);
  }

  /**
   * Invalidate subscription cache
   */
  invalidateSubscription(userId?: string): void {
    cacheService.delete(CacheKeys.SUBSCRIPTION(userId), CacheNamespace.USERS);
  }

  /**
   * Prefetch user data
   */
  async prefetch(userId?: string): Promise<void> {
    await Promise.all([
      this.getProfile(userId),
      this.getPreferences(userId),
      this.getSubscription(userId),
    ]);
  }
}

// ============================================================
// Export
// ============================================================

const cachedUserService = new CachedUserService();
export default cachedUserService;
export { CacheKeys as UserCacheKeys };
