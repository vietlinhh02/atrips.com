/**
 * Unified Cache Service
 *
 * High-level cache service that combines multiple cache backends
 * with smart defaults and easy-to-use API.
 */

import { getMemoryCache, MemoryCache } from './memoryCache';
import { getLocalStorageCache, getSessionStorageCache, StorageCache } from './storageCache';
import {
  CacheOptions,
  CacheStats,
  CacheTTL,
  CacheNamespace,
  CacheEvent,
  CacheEventHandler,
  CacheKeyParts,
} from './types';

// ============================================================
// Cache Service Class
// ============================================================

class CacheService {
  private memoryCache: MemoryCache;
  private localStorageCache: StorageCache;
  private sessionStorageCache: StorageCache;
  private debug: boolean;
  private eventHandlers: Set<CacheEventHandler> = new Set();

  constructor(debug = process.env.NODE_ENV === 'development') {
    this.debug = debug;
    this.memoryCache = getMemoryCache({ debug });
    this.localStorageCache = getLocalStorageCache({ debug });
    this.sessionStorageCache = getSessionStorageCache({ debug });

    // Forward events from all caches
    this.memoryCache.on((event) => this.emit(event));
    this.localStorageCache.on((event) => this.emit(event));
    this.sessionStorageCache.on((event) => this.emit(event));
  }

  // ============================================================
  // Core Methods
  // ============================================================

  /**
   * Get a cached value
   * Checks memory first, then storage based on options
   */
  get<T>(key: string, options: CacheOptions = {}): T | null {
    const { namespace, storage = 'memory' } = options;

    // Always check memory first for speed
    const memoryResult = this.memoryCache.get<T>(key, namespace);
    if (memoryResult !== null) {
      return memoryResult;
    }

    // Check storage if configured
    if (storage === 'localStorage') {
      const storageResult = this.localStorageCache.get<T>(key, namespace);
      if (storageResult !== null) {
        // Promote to memory cache for faster subsequent access
        this.memoryCache.set(key, storageResult, {
          ...options,
          ttl: options.ttl || CacheTTL.SHORT,
        });
        return storageResult;
      }
    } else if (storage === 'sessionStorage') {
      const storageResult = this.sessionStorageCache.get<T>(key, namespace);
      if (storageResult !== null) {
        this.memoryCache.set(key, storageResult, {
          ...options,
          ttl: options.ttl || CacheTTL.SHORT,
        });
        return storageResult;
      }
    }

    return null;
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const { storage = 'memory' } = options;

    // Always set in memory for fast access
    this.memoryCache.set(key, value, options);

    // Also set in storage if configured
    if (storage === 'localStorage') {
      this.localStorageCache.set(key, value, options);
    } else if (storage === 'sessionStorage') {
      this.sessionStorageCache.set(key, value, options);
    }
  }

  /**
   * Delete a cached value from all storage types
   */
  delete(key: string, namespace?: string): boolean {
    const memoryDeleted = this.memoryCache.delete(key, namespace);
    const localDeleted = this.localStorageCache.delete(key, namespace);
    const sessionDeleted = this.sessionStorageCache.delete(key, namespace);

    return memoryDeleted || localDeleted || sessionDeleted;
  }

  /**
   * Check if key exists in any cache
   */
  has(key: string, namespace?: string): boolean {
    return (
      this.memoryCache.has(key, namespace) ||
      this.localStorageCache.has(key, namespace) ||
      this.sessionStorageCache.has(key, namespace)
    );
  }

  /**
   * Clear cache by namespace or all
   */
  clear(namespace?: string): void {
    this.memoryCache.clear(namespace);
    this.localStorageCache.clear(namespace);
    this.sessionStorageCache.clear(namespace);
  }

  /**
   * Delete by pattern from all caches
   */
  deletePattern(pattern: string | RegExp, namespace?: string): number {
    const memoryDeleted = this.memoryCache.deletePattern(pattern, namespace);
    const localDeleted = this.localStorageCache.deletePattern(pattern, namespace);
    const sessionDeleted = this.sessionStorageCache.deletePattern(pattern, namespace);

    return memoryDeleted + localDeleted + sessionDeleted;
  }

  /**
   * Delete by tag from all caches
   */
  deleteByTag(tag: string): number {
    const memoryDeleted = this.memoryCache.deleteByTag(tag);
    const localDeleted = this.localStorageCache.deleteByTag(tag);
    const sessionDeleted = this.sessionStorageCache.deleteByTag(tag);

    return memoryDeleted + localDeleted + sessionDeleted;
  }

  // ============================================================
  // Cache-Aside Pattern
  // ============================================================

  /**
   * Get or set with fetcher function
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // Check for stale data
    if (options.staleWhileRevalidate) {
      const staleData = this.getStale<T>(key, options);
      if (staleData !== null) {
        this.revalidateInBackground(key, fetcher, options);
        return staleData;
      }
    }

    // Fetch and cache
    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }

  /**
   * Get stale data within grace period
   */
  getStale<T>(key: string, options: CacheOptions = {}): T | null {
    const { namespace, staleGracePeriod = 60, storage = 'memory' } = options;

    // Check memory first
    const memoryStale = this.memoryCache.getStale<T>(key, namespace, staleGracePeriod);
    if (memoryStale !== null) return memoryStale;

    // Check storage
    if (storage === 'localStorage') {
      return this.localStorageCache.getStale<T>(key, namespace, staleGracePeriod);
    } else if (storage === 'sessionStorage') {
      return this.sessionStorageCache.getStale<T>(key, namespace, staleGracePeriod);
    }

    return null;
  }

  // ============================================================
  // Specialized Cache Methods - Users
  // ============================================================

  /**
   * Cache user profile
   */
  setUserProfile<T>(userId: string, profile: T, ttl = CacheTTL.MEDIUM): void {
    this.set(`profile:${userId}`, profile, {
      namespace: CacheNamespace.USERS,
      ttl,
      storage: 'localStorage',
      tags: ['user', `user:${userId}`],
    });
  }

  /**
   * Get cached user profile
   */
  getUserProfile<T>(userId: string): T | null {
    return this.get<T>(`profile:${userId}`, {
      namespace: CacheNamespace.USERS,
      storage: 'localStorage',
    });
  }

  /**
   * Invalidate user-related caches
   */
  invalidateUserCaches(userId: string): void {
    this.deleteByTag(`user:${userId}`);
    this.delete(`profile:${userId}`, CacheNamespace.USERS);
    this.deletePattern(new RegExp(`^${userId}:`), CacheNamespace.USERS);
  }

  // ============================================================
  // Specialized Cache Methods - Auth
  // ============================================================

  /**
   * Cache current user
   */
  setCurrentUser<T>(user: T): void {
    this.set('currentUser', user, {
      namespace: CacheNamespace.AUTH,
      ttl: CacheTTL.MEDIUM,
      storage: 'memory',
    });
  }

  /**
   * Get cached current user
   */
  getCurrentUser<T>(): T | null {
    return this.get<T>('currentUser', {
      namespace: CacheNamespace.AUTH,
      storage: 'memory',
    });
  }

  /**
   * Clear auth caches on logout
   */
  clearAuthCaches(): void {
    this.clear(CacheNamespace.AUTH);
    this.clear(CacheNamespace.USERS);
  }

  // ============================================================
  // Specialized Cache Methods - Travel Profile
  // ============================================================

  /**
   * Cache travel profile
   */
  setTravelProfile<T>(userId: string, profile: T): void {
    this.set(`travel:${userId}`, profile, {
      namespace: CacheNamespace.TRAVEL_PROFILE,
      ttl: CacheTTL.LONG,
      storage: 'localStorage',
      tags: ['travelProfile', `user:${userId}`],
    });
  }

  /**
   * Get cached travel profile
   */
  getTravelProfile<T>(userId: string): T | null {
    return this.get<T>(`travel:${userId}`, {
      namespace: CacheNamespace.TRAVEL_PROFILE,
      storage: 'localStorage',
    });
  }

  // ============================================================
  // Specialized Cache Methods - API Responses
  // ============================================================

  /**
   * Cache API response
   */
  setApiResponse<T>(endpoint: string, params: Record<string, unknown>, data: T, ttl = CacheTTL.SHORT): void {
    const key = this.buildApiCacheKey(endpoint, params);
    this.set(key, data, {
      namespace: CacheNamespace.API,
      ttl,
      storage: 'memory',
      tags: ['api', `api:${endpoint}`],
    });
  }

  /**
   * Get cached API response
   */
  getApiResponse<T>(endpoint: string, params: Record<string, unknown>): T | null {
    const key = this.buildApiCacheKey(endpoint, params);
    return this.get<T>(key, {
      namespace: CacheNamespace.API,
      storage: 'memory',
    });
  }

  /**
   * Invalidate API responses for an endpoint
   */
  invalidateApiEndpoint(endpoint: string): void {
    this.deleteByTag(`api:${endpoint}`);
  }

  // ============================================================
  // Specialized Cache Methods - Settings
  // ============================================================

  /**
   * Cache user settings/preferences
   */
  setUserSettings<T>(userId: string, settings: T): void {
    this.set(`settings:${userId}`, settings, {
      namespace: CacheNamespace.SETTINGS,
      ttl: CacheTTL.DAY,
      storage: 'localStorage',
      tags: ['settings', `user:${userId}`],
    });
  }

  /**
   * Get cached user settings
   */
  getUserSettings<T>(userId: string): T | null {
    return this.get<T>(`settings:${userId}`, {
      namespace: CacheNamespace.SETTINGS,
      storage: 'localStorage',
    });
  }

  // ============================================================
  // Specialized Cache Methods - Static Data
  // ============================================================

  /**
   * Cache static/reference data
   */
  setStaticData<T>(key: string, data: T): void {
    this.set(key, data, {
      namespace: CacheNamespace.STATIC,
      ttl: CacheTTL.DAY,
      storage: 'localStorage',
    });
  }

  /**
   * Get cached static data
   */
  getStaticData<T>(key: string): T | null {
    return this.get<T>(key, {
      namespace: CacheNamespace.STATIC,
      storage: 'localStorage',
    });
  }

  // ============================================================
  // Statistics & Debugging
  // ============================================================

  /**
   * Get combined cache statistics
   */
  getStats(): CacheStats {
    const memoryStats = this.memoryCache.getStats();
    const localStats = this.localStorageCache.getStats();
    const sessionStats = this.sessionStorageCache.getStats();

    // Merge namespace counts
    const byNamespace: Record<string, number> = {};
    [memoryStats.byNamespace, localStats.byNamespace, sessionStats.byNamespace].forEach(
      (ns) => {
        Object.entries(ns).forEach(([key, count]) => {
          byNamespace[key] = (byNamespace[key] || 0) + count;
        });
      }
    );

    return {
      totalEntries:
        memoryStats.totalEntries + localStats.totalEntries + sessionStats.totalEntries,
      memoryEntries: memoryStats.memoryEntries,
      localStorageEntries: localStats.localStorageEntries,
      hits: memoryStats.hits + localStats.hits + sessionStats.hits,
      misses: memoryStats.misses + localStats.misses + sessionStats.misses,
      hitRatio:
        (memoryStats.hits + localStats.hits + sessionStats.hits) /
          Math.max(
            1,
            memoryStats.hits +
              localStats.hits +
              sessionStats.hits +
              memoryStats.misses +
              localStats.misses +
              sessionStats.misses
          ),
      totalSize: memoryStats.totalSize + localStats.totalSize + sessionStats.totalSize,
      byNamespace,
      lastCleanup: Math.max(
        memoryStats.lastCleanup || 0,
        localStats.lastCleanup || 0,
        sessionStats.lastCleanup || 0
      ),
    };
  }

  /**
   * Run cleanup on all caches
   */
  cleanup(): number {
    const memoryClean = this.memoryCache.cleanup();
    const localClean = this.localStorageCache.cleanup();
    const sessionClean = this.sessionStorageCache.cleanup();

    return memoryClean + localClean + sessionClean;
  }

  /**
   * Get storage info for localStorage
   */
  getStorageInfo(): { used: number; available: number; quota: number } {
    return this.localStorageCache.getStorageInfo();
  }

  // ============================================================
  // Event System
  // ============================================================

  /**
   * Subscribe to cache events
   */
  on(handler: CacheEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: CacheEvent): void {
    this.eventHandlers.forEach((handler) => handler(event));
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Build a cache key from parts
   */
  buildKey(...parts: CacheKeyParts): string {
    return parts
      .filter((p) => p !== null && p !== undefined)
      .map(String)
      .join(':');
  }

  /**
   * Build API cache key
   */
  private buildApiCacheKey(endpoint: string, params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}=${JSON.stringify(params[k])}`)
      .join('&');
    return `${endpoint}?${sortedParams}`;
  }

  /**
   * Revalidate in background
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const data = await fetcher();
      this.set(key, data, options);
    } catch (error) {
      this.log(`Background revalidation failed for ${key}:`, error);
    }
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[CacheService]', ...args);
    }
  }

  // ============================================================
  // Cleanup
  // ============================================================

  /**
   * Destroy all cache instances
   */
  destroy(): void {
    this.memoryCache.destroy();
    this.localStorageCache.destroy();
    this.sessionStorageCache.destroy();
    this.eventHandlers.clear();
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let cacheServiceInstance: CacheService | null = null;

export function getCacheService(debug?: boolean): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(debug);
  }
  return cacheServiceInstance;
}

// Export singleton for convenience
export const cacheService = getCacheService();

export { CacheService };
export default cacheService;
