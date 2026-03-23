/**
 * useCache Hook
 *
 * Simple hook for cache access in React components.
 * Provides reactive cache state and easy manipulation.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { cacheService } from '../lib/cache/cacheService';
import { CacheOptions, CacheEvent } from '../lib/cache/types';

// ============================================================
// Types
// ============================================================

export interface UseCacheResult<T> {
  /** Current cached value */
  value: T | null;
  /** Set a value in cache */
  set: (value: T, options?: CacheOptions) => void;
  /** Remove value from cache */
  remove: () => boolean;
  /** Check if key exists */
  exists: boolean;
  /** Clear all cache or by namespace */
  clearAll: (namespace?: string) => void;
}

export interface UseCacheOptions extends CacheOptions {
  /** Watch for changes from other sources */
  watch?: boolean;
}

// ============================================================
// useCache Hook
// ============================================================

/**
 * Hook for simple cache access
 *
 * @example
 * ```tsx
 * const { value, set, remove } = useCache<User>('currentUser', {
 *   namespace: 'users',
 *   storage: 'localStorage'
 * });
 *
 * // Set value
 * set({ id: '123', name: 'John' });
 *
 * // Read value
 * console.log(value);
 *
 * // Remove value
 * remove();
 * ```
 */
export function useCache<T>(
  key: string,
  options: UseCacheOptions = {}
): UseCacheResult<T> {
  const { namespace, storage = 'memory', watch = true } = options;

  // State
  const [value, setValue] = useState<T | null>(() => {
    return cacheService.get<T>(key, { namespace, storage });
  });

  // Set value in cache
  const set = useCallback(
    (newValue: T, setOptions?: CacheOptions) => {
      const mergedOptions = { ...options, ...setOptions };
      cacheService.set(key, newValue, mergedOptions);
      setValue(newValue);
    },
    [key, options]
  );

  // Remove value from cache
  const remove = useCallback(() => {
    const deleted = cacheService.delete(key, namespace);
    setValue(null);
    return deleted;
  }, [key, namespace]);

  // Clear all cache
  const clearAll = useCallback((ns?: string) => {
    cacheService.clear(ns);
    setValue(null);
  }, []);

  // Check if exists
  const exists = value !== null;

  // Watch for changes
  useEffect(() => {
    if (!watch) return;

    const unsubscribe = cacheService.on((event: CacheEvent) => {
      if (event.key?.includes(key) && event.namespace === namespace) {
        if (event.type === 'set' || event.type === 'delete' || event.type === 'expire') {
          const newValue = cacheService.get<T>(key, { namespace, storage });
          setValue(newValue);
        }
      }
    });

    return unsubscribe;
  }, [key, namespace, storage, watch]);

  return {
    value,
    set,
    remove,
    exists,
    clearAll,
  };
}

// ============================================================
// useCachedState Hook
// ============================================================

/**
 * useState-like hook with automatic cache persistence
 *
 * @example
 * ```tsx
 * const [theme, setTheme] = useCachedState('theme', 'light', {
 *   storage: 'localStorage',
 *   ttl: CacheTTL.WEEK
 * });
 *
 * // Works like useState
 * setTheme('dark');
 * ```
 */
export function useCachedState<T>(
  key: string,
  initialValue: T,
  options: CacheOptions = {}
): [T, (value: T | ((prev: T) => T)) => void] {
  const { namespace, storage = 'localStorage' } = options;

  // Initialize state from cache or initial value
  const [state, setState] = useState<T>(() => {
    const cached = cacheService.get<T>(key, { namespace, storage });
    return cached ?? initialValue;
  });

  // Setter that syncs with cache
  const setCachedState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
        cacheService.set(key, newValue, options);
        return newValue;
      });
    },
    [key, options]
  );

  return [state, setCachedState];
}

// ============================================================
// useCacheStats Hook
// ============================================================

/**
 * Hook for monitoring cache statistics
 *
 * @example
 * ```tsx
 * const stats = useCacheStats();
 *
 * console.log(`Hit ratio: ${(stats.hitRatio * 100).toFixed(1)}%`);
 * console.log(`Total entries: ${stats.totalEntries}`);
 * ```
 */
export function useCacheStats(refreshInterval = 5000) {
  const [stats, setStats] = useState(() => cacheService.getStats());

  useEffect(() => {
    const updateStats = () => {
      setStats(cacheService.getStats());
    };

    const interval = setInterval(updateStats, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  return stats;
}

// ============================================================
// useCacheInvalidation Hook
// ============================================================

/**
 * Hook for cache invalidation utilities
 *
 * @example
 * ```tsx
 * const { invalidatePattern, invalidateTag, invalidateAll } = useCacheInvalidation();
 *
 * // Invalidate by pattern
 * invalidatePattern(/^user:/);
 *
 * // Invalidate by tag
 * invalidateTag('user:123');
 *
 * // Invalidate all
 * invalidateAll('users');
 * ```
 */
export function useCacheInvalidation() {
  const invalidatePattern = useCallback(
    (pattern: string | RegExp, namespace?: string) => {
      return cacheService.deletePattern(pattern, namespace);
    },
    []
  );

  const invalidateTag = useCallback((tag: string) => {
    return cacheService.deleteByTag(tag);
  }, []);

  const invalidateAll = useCallback((namespace?: string) => {
    cacheService.clear(namespace);
  }, []);

  const invalidateUser = useCallback((userId: string) => {
    cacheService.invalidateUserCaches(userId);
  }, []);

  const invalidateAuth = useCallback(() => {
    cacheService.clearAuthCaches();
  }, []);

  return {
    invalidatePattern,
    invalidateTag,
    invalidateAll,
    invalidateUser,
    invalidateAuth,
  };
}

export default useCache;
