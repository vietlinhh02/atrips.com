/**
 * In-Memory Cache Client
 *
 * Fast, ephemeral cache that lives in browser memory.
 * Ideal for short-lived data and SWR patterns.
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
} from './types';

// ============================================================
// Default Configuration
// ============================================================

const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: CacheTTL.MEDIUM,
  maxMemoryEntries: 1000,
  maxLocalStorageSize: 5 * 1024 * 1024, // 5MB
  debug: process.env.NODE_ENV === 'development',
  storageKeyPrefix: 'atrips_cache_',
  cleanupInterval: 60000, // 1 minute
  enableAutoCleanup: true,
};

// ============================================================
// Memory Cache Class
// ============================================================

class MemoryCache implements ICacheClient {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private eventHandlers: Set<CacheEventHandler> = new Set();

  // Statistics
  private stats = {
    hits: 0,
    misses: 0,
    lastCleanup: null as number | null,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start auto cleanup if enabled and in browser
    if (this.config.enableAutoCleanup && typeof window !== 'undefined') {
      this.startAutoCleanup();
    }
  }

  // ============================================================
  // Core Methods
  // ============================================================

  /**
   * Get a cached value
   */
  get<T>(key: string, namespace?: string): T | null {
    const fullKey = this.buildKey(key, namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      this.stats.misses++;
      this.emit({ type: 'miss', key: fullKey, namespace, timestamp: Date.now() });
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      this.emit({ type: 'expire', key: fullKey, namespace, timestamp: Date.now() });
      return null;
    }

    // Update access stats
    entry.hitCount = (entry.hitCount || 0) + 1;
    entry.lastAccessedAt = Date.now();

    this.stats.hits++;
    this.emit({ type: 'hit', key: fullKey, namespace, timestamp: Date.now() });

    this.log(`Cache HIT: ${fullKey}`);
    return entry.data as T;
  }

  /**
   * Set a cached value
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const {
      ttl = this.config.defaultTTL,
      namespace,
      tags,
    } = options;

    const fullKey = this.buildKey(key, namespace);
    const now = Date.now();

    // Check max entries limit
    if (this.cache.size >= this.config.maxMemoryEntries) {
      this.evictLRU();
    }

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

    this.cache.set(fullKey, entry);
    this.emit({ type: 'set', key: fullKey, namespace, timestamp: now });
    this.log(`Cache SET: ${fullKey} (TTL: ${ttl}s)`);
  }

  /**
   * Delete a cached value
   */
  delete(key: string, namespace?: string): boolean {
    const fullKey = this.buildKey(key, namespace);
    const deleted = this.cache.delete(fullKey);

    if (deleted) {
      this.emit({ type: 'delete', key: fullKey, namespace, timestamp: Date.now() });
      this.log(`Cache DELETE: ${fullKey}`);
    }

    return deleted;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string, namespace?: string): boolean {
    const fullKey = this.buildKey(key, namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  /**
   * Clear all cache or by namespace
   */
  clear(namespace?: string): void {
    if (namespace) {
      const prefix = `${namespace}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
      this.log(`Cache CLEAR namespace: ${namespace}`);
    } else {
      this.cache.clear();
      this.log('Cache CLEAR all');
    }

    this.emit({ type: 'clear', namespace, timestamp: Date.now() });
  }

  /**
   * Delete entries matching a pattern
   */
  deletePattern(pattern: string | RegExp, namespace?: string): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (namespace && !key.startsWith(`${namespace}:`)) continue;
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    this.log(`Cache DELETE pattern: ${pattern} (deleted: ${deleted})`);
    return deleted;
  }

  /**
   * Delete entries by tag
   */
  deleteByTag(tag: string): number {
    let deleted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.includes(tag)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    this.log(`Cache DELETE by tag: ${tag} (deleted: ${deleted})`);
    return deleted;
  }

  /**
   * Get all keys
   */
  keys(namespace?: string): string[] {
    const allKeys = Array.from(this.cache.keys());

    if (namespace) {
      const prefix = `${namespace}:`;
      return allKeys.filter((key) => key.startsWith(prefix));
    }

    return allKeys;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const byNamespace: Record<string, number> = {};
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      const ns = entry.namespace || 'default';
      byNamespace[ns] = (byNamespace[ns] || 0) + 1;

      // Estimate size (rough approximation)
      totalSize += JSON.stringify(entry.data).length * 2; // UTF-16
    }

    const totalRequests = this.stats.hits + this.stats.misses;

    return {
      totalEntries: this.cache.size,
      memoryEntries: this.cache.size,
      localStorageEntries: 0,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRatio: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      totalSize,
      byNamespace,
      lastCleanup: this.stats.lastCleanup,
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.stats.lastCleanup = now;
    this.emit({ type: 'cleanup', timestamp: now, metadata: { cleaned } });
    this.log(`Cache CLEANUP: removed ${cleaned} expired entries`);

    return cleaned;
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
    const fullKey = this.buildKey(key, namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) return null;

    const now = Date.now();
    const graceExpiry = entry.expiresAt + gracePeriodSeconds * 1000;

    if (now < graceExpiry) {
      return entry.data as T;
    }

    return null;
  }

  /**
   * Refresh TTL for an existing entry
   */
  touch(key: string, namespace?: string, newTTL?: number): boolean {
    const fullKey = this.buildKey(key, namespace);
    const entry = this.cache.get(fullKey);

    if (!entry || this.isExpired(entry)) return false;

    const ttl = newTTL || entry.ttl;
    entry.expiresAt = Date.now() + ttl * 1000;
    entry.lastAccessedAt = Date.now();

    return true;
  }

  /**
   * Get entry metadata
   */
  getEntryInfo(key: string, namespace?: string): Omit<CacheEntry, 'data'> | null {
    const fullKey = this.buildKey(key, namespace);
    const entry = this.cache.get(fullKey);

    if (!entry) return null;

    const metadata = { ...entry };
    delete (metadata as Partial<CacheEntry>).data;
    return metadata as Omit<CacheEntry, 'data'>;
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
    return namespace ? `${namespace}:${key}` : key;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private evictLRU(): void {
    // Find least recently used entry
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      const accessTime = entry.lastAccessedAt || entry.createdAt;
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.log(`Cache EVICT LRU: ${oldestKey}`);
    }
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
      console.log('[MemoryCache]', ...args);
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
    this.cache.clear();
    this.eventHandlers.clear();
  }
}

// ============================================================
// Singleton Instance
// ============================================================

let memoryCacheInstance: MemoryCache | null = null;

export function getMemoryCache(config?: Partial<CacheConfig>): MemoryCache {
  if (!memoryCacheInstance) {
    memoryCacheInstance = new MemoryCache(config);
  }
  return memoryCacheInstance;
}

export { MemoryCache };
export default getMemoryCache;
