/**
 * Cache System Types for Next.js Frontend
 *
 * Provides type-safe caching with TTL support, namespaces,
 * and multiple storage backends (memory, localStorage).
 */

// ============================================================
// TTL Constants (in seconds)
// ============================================================

export const CacheTTL = {
  /** 1 minute - For real-time data */
  VERY_SHORT: 60,
  /** 5 minutes - For frequently changing data */
  SHORT: 300,
  /** 10 minutes - Standard cache duration */
  MEDIUM: 600,
  /** 30 minutes - For stable data */
  LONG: 1800,
  /** 1 hour - For rarely changing data */
  VERY_LONG: 3600,
  /** 24 hours - For static content */
  DAY: 86400,
  /** 7 days - For very stable data */
  WEEK: 604800,
} as const;

export type CacheTTLValue = (typeof CacheTTL)[keyof typeof CacheTTL];

// ============================================================
// Namespace Constants
// ============================================================

export const CacheNamespace = {
  /** User-related data */
  USERS: 'users',
  /** Authentication data */
  AUTH: 'auth',
  /** Travel profile data */
  TRAVEL_PROFILE: 'travel_profile',
  /** Trip data */
  TRIPS: 'trips',
  /** Places data */
  PLACES: 'places',
  /** API responses */
  API: 'api',
  /** Session data */
  SESSIONS: 'sessions',
  /** Settings and preferences */
  SETTINGS: 'settings',
  /** Static/reference data */
  STATIC: 'static',
} as const;

export type CacheNamespaceValue = (typeof CacheNamespace)[keyof typeof CacheNamespace];

// ============================================================
// Cache Storage Types
// ============================================================

export type CacheStorageType = 'memory' | 'localStorage' | 'sessionStorage';

// ============================================================
// Cache Entry Interface
// ============================================================

export interface CacheEntry<T = unknown> {
  /** The cached data */
  data: T;
  /** Timestamp when the entry was created (ms) */
  createdAt: number;
  /** Timestamp when the entry expires (ms) */
  expiresAt: number;
  /** TTL in seconds */
  ttl: number;
  /** Optional namespace for grouping */
  namespace?: CacheNamespaceValue | string;
  /** Optional tags for batch invalidation */
  tags?: string[];
  /** Number of times this entry was accessed */
  hitCount?: number;
  /** Last access timestamp */
  lastAccessedAt?: number;
}

// ============================================================
// Cache Options Interface
// ============================================================

export interface CacheOptions {
  /** Time to live in seconds */
  ttl?: number;
  /** Namespace for grouping related cache entries */
  namespace?: CacheNamespaceValue | string;
  /** Tags for batch invalidation */
  tags?: string[];
  /** Storage type (memory, localStorage, sessionStorage) */
  storage?: CacheStorageType;
  /** Whether to update TTL on access (sliding expiration) */
  slidingExpiration?: boolean;
  /** Stale-while-revalidate: return stale data while fetching fresh */
  staleWhileRevalidate?: boolean;
  /** Grace period (seconds) for stale-while-revalidate */
  staleGracePeriod?: number;
}

// ============================================================
// Cache Config Interface
// ============================================================

export interface CacheConfig {
  /** Default TTL for cache entries */
  defaultTTL: number;
  /** Maximum number of entries in memory cache */
  maxMemoryEntries: number;
  /** Maximum size of localStorage cache in bytes */
  maxLocalStorageSize: number;
  /** Enable debug logging */
  debug: boolean;
  /** Prefix for localStorage keys */
  storageKeyPrefix: string;
  /** Cleanup interval in ms (for expired entries) */
  cleanupInterval: number;
  /** Enable automatic cleanup */
  enableAutoCleanup: boolean;
}

// ============================================================
// Cache Statistics Interface
// ============================================================

export interface CacheStats {
  /** Total number of cache entries */
  totalEntries: number;
  /** Memory cache entries */
  memoryEntries: number;
  /** LocalStorage cache entries */
  localStorageEntries: number;
  /** Cache hits */
  hits: number;
  /** Cache misses */
  misses: number;
  /** Hit ratio (hits / total requests) */
  hitRatio: number;
  /** Total size in bytes (estimated) */
  totalSize: number;
  /** Entries by namespace */
  byNamespace: Record<string, number>;
  /** Last cleanup timestamp */
  lastCleanup: number | null;
}

// ============================================================
// Cache Client Interface
// ============================================================

export interface ICacheClient {
  /** Get a cached value */
  get<T>(key: string, namespace?: string): T | null;

  /** Set a cached value */
  set<T>(key: string, value: T, options?: CacheOptions): void;

  /** Delete a cached value */
  delete(key: string, namespace?: string): boolean;

  /** Check if key exists and is not expired */
  has(key: string, namespace?: string): boolean;

  /** Clear all cache or by namespace */
  clear(namespace?: string): void;

  /** Delete entries matching a pattern */
  deletePattern(pattern: string | RegExp, namespace?: string): number;

  /** Delete entries by tag */
  deleteByTag(tag: string): number;

  /** Get all keys */
  keys(namespace?: string): string[];

  /** Get cache statistics */
  getStats(): CacheStats;

  /** Cleanup expired entries */
  cleanup(): number;
}

// ============================================================
// Fetcher Types for SWR-like patterns
// ============================================================

export type Fetcher<T, Args extends unknown[] = []> = (...args: Args) => Promise<T>;

export interface UseCacheQueryOptions<T> extends CacheOptions {
  /** Initial/fallback data */
  initialData?: T;
  /** Revalidate on window focus */
  revalidateOnFocus?: boolean;
  /** Revalidate on network reconnect */
  revalidateOnReconnect?: boolean;
  /** Polling interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Retry count on error */
  retryCount?: number;
  /** Retry delay in ms */
  retryDelay?: number;
  /** Error callback */
  onError?: (error: Error) => void;
  /** Success callback */
  onSuccess?: (data: T) => void;
  /** Whether query should run */
  enabled?: boolean;
  /** Dedupe interval in ms */
  dedupeInterval?: number;
}

export interface UseCacheQueryResult<T> {
  /** The cached/fetched data */
  data: T | undefined;
  /** Error if fetch failed */
  error: Error | null;
  /** Whether currently fetching */
  isLoading: boolean;
  /** Whether this is the first fetch */
  isInitialLoading: boolean;
  /** Whether currently validating/refreshing */
  isValidating: boolean;
  /** Whether data is stale */
  isStale: boolean;
  /** Manually trigger revalidation */
  revalidate: () => Promise<void>;
  /** Manually mutate the cache */
  mutate: (data: T | ((current: T | undefined) => T)) => void;
  /** Clear this cache entry */
  clear: () => void;
}

// ============================================================
// Cache Event Types
// ============================================================

export type CacheEventType =
  | 'set'
  | 'get'
  | 'delete'
  | 'clear'
  | 'expire'
  | 'cleanup'
  | 'hit'
  | 'miss';

export interface CacheEvent {
  type: CacheEventType;
  key?: string;
  namespace?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type CacheEventHandler = (event: CacheEvent) => void;

// ============================================================
// Utility Types
// ============================================================

/** Generate cache key from parts */
export type CacheKeyParts = (string | number | boolean | null | undefined)[];

/** Cache key generator function */
export type CacheKeyGenerator<Args extends unknown[]> = (...args: Args) => string;

/** Serializable data types for cache */
export type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | Serializable[]
  | { [key: string]: Serializable };
