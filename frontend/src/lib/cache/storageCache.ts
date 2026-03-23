/**
 * Storage Cache Client (localStorage/sessionStorage)
 *
 * Persistent cache that survives page reloads.
 * Ideal for user preferences, static data, and long-lived cache.
 */

import {
  CacheEntry,
  CacheOptions,
  CacheStats,
  CacheTTL,
  CacheConfig,
  ICacheClient,
  CacheEvent,
  CacheEventHandler,
  CacheStorageType,
} from './types';

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: CacheTTL.LONG,
  maxMemoryEntries: 1000,
  maxLocalStorageSize: 5 * 1024 * 1024, // 5MB
  debug: process.env.NODE_ENV === 'development',
  storageKeyPrefix: 'atrips_cache_',
  cleanupInterval: 300000, // 5 minutes
  enableAutoCleanup: true,
};

// ============================================================
// Storage Cache Class
// ============================================================

class StorageCache implements ICacheClient {
  private config: CacheConfig;
  private storageType: CacheStorageType;
  private storage: Storage | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Set<CacheEventHandler> = new Set();

  // Statistics (kept in memory)
  private stats = {
    hits: 0,
    misses: 0,
    lastCleanup: null as number | null,
  };

  constructor(
    storageType: CacheStorageType = 'localStorage',
    config: Partial<CacheConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageType = storageType;

    // Initialize storage
    if (typeof window !== 'undefined') {
      this.storage =
        storageType === 'sessionStorage' ? window.sessionStorage : window.localStorage;

      // Start auto cleanup if enabled
      if (this.config.enableAutoCleanup) {
        this.startAutoCleanup();
      }
    }
  }

  // ============================================================
  // Core Methods
  // ============================================================

  /**
   * Get a cached value
   */
  get<T>(key: string, namespace?: string): T | null {
    if (!this.storage) return null;

    const fullKey = this.buildKey(key, namespace);

    try {
      const raw = this.storage.getItem(fullKey);

      if (!raw) {
        this.stats.misses++;
        this.emit({ type: 'miss', key: fullKey, namespace, timestamp: Date.now() });
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(raw);

      // Check if expired
      if (this.isExpired(entry)) {
        this.storage.removeItem(fullKey);
        this.stats.misses++;
        this.emit({ type: 'expire', key: fullKey, namespace, timestamp: Date.now() });
        return null;
      }

      // Update access stats
      entry.hitCount = (entry.hitCount || 0) + 1;
      entry.lastAccessedAt = Date.now();
      this.storage.setItem(fullKey, JSON.stringify(entry));

      this.stats.hits++;
      this.emit({ type: 'hit', key: fullKey, namespace, timestamp: Date.now() });

      this.log(`Cache HIT: ${fullKey}`);
      return entry.data;
    } catch (error) {
      this.log(`Cache GET error for ${fullKey}:`, error);
      return null;
    }
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    if (!this.storage) return;

    const { ttl = this.config.defaultTTL, namespace, tags } = options;

    const fullKey = this.buildKey(key, namespace);
    const now = Date.now();

    const entry: CacheEntry<T> = {
      data: value,
      createdAt: now,
      expiresAt: now + ttl * 1000,
      ttl,
      namespace,
      tags,
      hitCount: 0,
      lastAccessedAt: now,
    };

    try {
      const serialized = JSON.stringify(entry);

      // Check storage quota
      if (this.wouldExceedQuota(serialized.length)) {
        this.evictOldest(serialized.length);
      }

      this.storage.setItem(fullKey, serialized);
      this.emit({ type: 'set', key: fullKey, namespace, timestamp: now });
      this.log(`Cache SET: ${fullKey} (TTL: ${ttl}s)`);
    } catch (error) {
      // Storage quota exceeded
      if (this.isQuotaError(error)) {
        this.log('Storage quota exceeded, evicting old entries...');
        this.evictOldest(JSON.stringify(entry).length);

        try {
          this.storage.setItem(fullKey, JSON.stringify(entry));
        } catch {
          this.log('Failed to set cache even after eviction');
        }
      } else {
        this.log(`Cache SET error for ${fullKey}:`, error);
      }
    }
  }

  /**
   * Delete a cached value
   */
  delete(key: string, namespace?: string): boolean {
    if (!this.storage) return false;

    const fullKey = this.buildKey(key, namespace);

    try {
      const existed = this.storage.getItem(fullKey) !== null;
      this.storage.removeItem(fullKey);

      if (existed) {
        this.emit({ type: 'delete', key: fullKey, namespace, timestamp: Date.now() });
        this.log(`Cache DELETE: ${fullKey}`);
      }

      return existed;
    } catch (error) {
      this.log(`Cache DELETE error for ${fullKey}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string, namespace?: string): boolean {
    if (!this.storage) return false;

    const fullKey = this.buildKey(key, namespace);

    try {
      const raw = this.storage.getItem(fullKey);
      if (!raw) return false;

      const entry: CacheEntry = JSON.parse(raw);
      if (this.isExpired(entry)) {
        this.storage.removeItem(fullKey);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all cache or by namespace
   */
  clear(namespace?: string): void {
    if (!this.storage) return;

    const keysToDelete: string[] = [];

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key || !key.startsWith(this.config.storageKeyPrefix)) continue;

      if (namespace) {
        const nsPrefix = `${this.config.storageKeyPrefix}${namespace}:`;
        if (key.startsWith(nsPrefix)) {
          keysToDelete.push(key);
        }
      } else {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.storage!.removeItem(key));

    this.emit({ type: 'clear', namespace, timestamp: Date.now() });
    this.log(
      namespace ? `Cache CLEAR namespace: ${namespace}` : 'Cache CLEAR all'
    );
  }

  /**
   * Delete entries matching a pattern
   */
  deletePattern(pattern: string | RegExp, namespace?: string): number {
    if (!this.storage) return 0;

    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keysToDelete: string[] = [];

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key || !key.startsWith(this.config.storageKeyPrefix)) continue;

      // Remove prefix for pattern matching
      const keyWithoutPrefix = key.slice(this.config.storageKeyPrefix.length);

      if (namespace && !keyWithoutPrefix.startsWith(`${namespace}:`)) continue;
      if (regex.test(keyWithoutPrefix)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.storage!.removeItem(key));

    this.log(`Cache DELETE pattern: ${pattern} (deleted: ${keysToDelete.length})`);
    return keysToDelete.length;
  }

  /**
   * Delete entries by tag
   */
  deleteByTag(tag: string): number {
    if (!this.storage) return 0;

    const keysToDelete: string[] = [];

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key || !key.startsWith(this.config.storageKeyPrefix)) continue;

      try {
        const raw = this.storage.getItem(key);
        if (!raw) continue;

        const entry: CacheEntry = JSON.parse(raw);
        if (entry.tags?.includes(tag)) {
          keysToDelete.push(key);
        }
      } catch {
        continue;
      }
    }

    keysToDelete.forEach((key) => this.storage!.removeItem(key));

    this.log(`Cache DELETE by tag: ${tag} (deleted: ${keysToDelete.length})`);
    return keysToDelete.length;
  }

  /**
   * Get all keys
   */
  keys(namespace?: string): string[] {
    if (!this.storage) return [];

    const result: string[] = [];

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key || !key.startsWith(this.config.storageKeyPrefix)) continue;

      const keyWithoutPrefix = key.slice(this.config.storageKeyPrefix.length);

      if (namespace) {
        if (keyWithoutPrefix.startsWith(`${namespace}:`)) {
          result.push(keyWithoutPrefix);
        }
      } else {
        result.push(keyWithoutPrefix);
      }
    }

    return result;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const byNamespace: Record<string, number> = {};
    let totalSize = 0;
    let entryCount = 0;

    if (this.storage) {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key || !key.startsWith(this.config.storageKeyPrefix)) continue;

        const value = this.storage.getItem(key);
        if (!value) continue;

        entryCount++;
        totalSize += key.length + value.length;

        try {
          const entry: CacheEntry = JSON.parse(value);
          const ns = entry.namespace || 'default';
          byNamespace[ns] = (byNamespace[ns] || 0) + 1;
        } catch {
          byNamespace['unknown'] = (byNamespace['unknown'] || 0) + 1;
        }
      }
    }

    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      totalEntries: entryCount,
      memoryEntries: 0,
      localStorageEntries: entryCount,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRatio: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      totalSize: totalSize * 2, // UTF-16
      byNamespace,
      lastCleanup: this.stats.lastCleanup,
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    if (!this.storage) return 0;

    const keysToDelete: string[] = [];

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key || !key.startsWith(this.config.storageKeyPrefix)) continue;

      try {
        const raw = this.storage.getItem(key);
        if (!raw) continue;

        const entry: CacheEntry = JSON.parse(raw);
        if (this.isExpired(entry)) {
          keysToDelete.push(key);
        }
      } catch {
        // Invalid entry, delete it
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.storage!.removeItem(key));

    this.stats.lastCleanup = Date.now();
    this.emit({
      type: 'cleanup',
      timestamp: Date.now(),
      metadata: { cleaned: keysToDelete.length },
    });
    this.log(`Cache CLEANUP: removed ${keysToDelete.length} expired entries`);

    return keysToDelete.length;
  }

  // ============================================================
  // Advanced Methods
  // ============================================================

  /**
   * Get or set (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { namespace, staleWhileRevalidate = false, staleGracePeriod = 60 } = options;

    const cached = this.get<T>(key, namespace);

    if (cached !== null) {
      return cached;
    }

    // Check for stale data if staleWhileRevalidate is enabled
    if (staleWhileRevalidate) {
      const staleData = this.getStale<T>(key, namespace, staleGracePeriod);
      if (staleData !== null) {
        // Return stale data and revalidate in background
        this.revalidateInBackground(key, fetcher, options);
        return staleData;
      }
    }

    // Fetch fresh data
    const data = await fetcher();
    this.set(key, data, options);
    return data;
  }

  /**
   * Get stale data (even if expired, within grace period)
   */
  getStale<T>(key: string, namespace?: string, gracePeriodSeconds = 60): T | null {
    if (!this.storage) return null;

    const fullKey = this.buildKey(key, namespace);

    try {
      const raw = this.storage.getItem(fullKey);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      const now = Date.now();
      const graceExpiry = entry.expiresAt + gracePeriodSeconds * 1000;

      if (now < graceExpiry) {
        return entry.data;
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Get remaining TTL in seconds
   */
  getTTL(key: string, namespace?: string): number | null {
    if (!this.storage) return null;

    const fullKey = this.buildKey(key, namespace);

    try {
      const raw = this.storage.getItem(fullKey);
      if (!raw) return null;

      const entry: CacheEntry = JSON.parse(raw);
      const remaining = Math.max(0, entry.expiresAt - Date.now());
      return Math.floor(remaining / 1000);
    } catch {
      return null;
    }
  }

  /**
   * Get storage usage info
   */
  getStorageInfo(): { used: number; available: number; quota: number } {
    if (!this.storage) {
      return { used: 0, available: 0, quota: 0 };
    }

    let used = 0;
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key) {
        const value = this.storage.getItem(key);
        used += (key.length + (value?.length || 0)) * 2; // UTF-16
      }
    }

    const quota = this.config.maxLocalStorageSize;
    const available = Math.max(0, quota - used);

    return { used, available, quota };
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

  /**
   * Emit a cache event
   */
  private emit(event: CacheEvent): void {
    this.eventHandlers.forEach((handler) => handler(event));
  }

  // ============================================================
  // Private Helpers
  // ============================================================

  private buildKey(key: string, namespace?: string): string {
    const nsKey = namespace ? `${namespace}:${key}` : key;
    return `${this.config.storageKeyPrefix}${nsKey}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private wouldExceedQuota(additionalBytes: number): boolean {
    const { used, quota } = this.getStorageInfo();
    return used + additionalBytes > quota * 0.9; // 90% threshold
  }

  private evictOldest(neededBytes: number): void {
    if (!this.storage) return;

    // Get all cache entries with their metadata
    const entries: Array<{ key: string; accessTime: number; size: number }> = [];

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (!key || !key.startsWith(this.config.storageKeyPrefix)) continue;

      try {
        const raw = this.storage.getItem(key);
        if (!raw) continue;

        const entry: CacheEntry = JSON.parse(raw);
        entries.push({
          key,
          accessTime: entry.lastAccessedAt || entry.createdAt,
          size: key.length + raw.length,
        });
      } catch {
        continue;
      }
    }

    // Sort by access time (oldest first)
    entries.sort((a, b) => a.accessTime - b.accessTime);

    // Evict until we have enough space
    let freedBytes = 0;
    for (const entry of entries) {
      if (freedBytes >= neededBytes) break;

      this.storage.removeItem(entry.key);
      freedBytes += entry.size * 2; // UTF-16
      this.log(`Cache EVICT: ${entry.key}`);
    }
  }

  private isQuotaError(error: unknown): boolean {
    if (error instanceof DOMException) {
      // Chrome, Firefox
      return (
        error.code === 22 ||
        error.code === 1014 ||
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      );
    }
    return false;
  }

  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

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
    if (this.config.debug) {
      console.log(`[StorageCache:${this.storageType}]`, ...args);
    }
  }

  // ============================================================
  // Cleanup
  // ============================================================

  /**
   * Destroy the cache instance
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.eventHandlers.clear();
  }
}

// ============================================================
// Singleton Instances
// ============================================================

let localStorageCacheInstance: StorageCache | null = null;
let sessionStorageCacheInstance: StorageCache | null = null;

export function getLocalStorageCache(config?: Partial<CacheConfig>): StorageCache {
  if (!localStorageCacheInstance) {
    localStorageCacheInstance = new StorageCache('localStorage', config);
  }
  return localStorageCacheInstance;
}

export function getSessionStorageCache(config?: Partial<CacheConfig>): StorageCache {
  if (!sessionStorageCacheInstance) {
    sessionStorageCacheInstance = new StorageCache('sessionStorage', config);
  }
  return sessionStorageCacheInstance;
}

export { StorageCache };
export default getLocalStorageCache;
