/**
 * useCacheQuery Hook
 *
 * SWR-like data fetching hook with integrated caching.
 * Provides automatic caching, revalidation, and error handling.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheService } from '../lib/cache/cacheService';
import {
  UseCacheQueryOptions,
  UseCacheQueryResult,
  CacheOptions,
  CacheTTL,
} from '../lib/cache/types';

// ============================================================
// Deduplication Map
// ============================================================

const pendingRequests = new Map<string, Promise<unknown>>();

// ============================================================
// useCacheQuery Hook
// ============================================================

export function useCacheQuery<T>(
  key: string | null | undefined,
  fetcher: () => Promise<T>,
  options: UseCacheQueryOptions<T> = {}
): UseCacheQueryResult<T> {
  const {
    initialData,
    ttl = CacheTTL.MEDIUM,
    namespace,
    storage = 'memory',
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    refreshInterval = 0,
    retryCount = 3,
    retryDelay = 1000,
    onError,
    onSuccess,
    enabled = true,
    dedupeInterval = 2000,
    staleWhileRevalidate = true,
    staleGracePeriod = 60,
    tags,
  } = options;

  // State
  const [data, setData] = useState<T | undefined>(() => {
    if (key) {
      const cached = cacheService.get<T>(key, { namespace, storage });
      return cached ?? initialData;
    }
    return initialData;
  });
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!data && enabled && !!key);
  const [isValidating, setIsValidating] = useState(false);
  const [isStale, setIsStale] = useState(false);

  // Refs
  const mountedRef = useRef(true);
  const lastFetchRef = useRef<number>(0);
  const retryCountRef = useRef(0);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if initial loading
  const isInitialLoading = isLoading && !data;

  // ============================================================
  // Fetch Function
  // ============================================================

  const fetchData = useCallback(
    async (forceRevalidate = false): Promise<void> => {
      if (!key || !enabled) return;

      const now = Date.now();

      // Check deduplication
      if (!forceRevalidate && now - lastFetchRef.current < dedupeInterval) {
        return;
      }

      // Check for pending request (dedupe)
      const pendingKey = `${namespace || ''}:${key}`;
      if (pendingRequests.has(pendingKey)) {
        try {
          const result = (await pendingRequests.get(pendingKey)) as T;
          if (mountedRef.current) {
            setData(result);
            setIsLoading(false);
            setIsValidating(false);
          }
          return;
        } catch {
          // Let it fall through to retry
        }
      }

      // Check cache first
      if (!forceRevalidate) {
        const cached = cacheService.get<T>(key, { namespace, storage });
        if (cached !== null) {
          if (mountedRef.current) {
            setData(cached);
            setIsLoading(false);
            setIsStale(false);
          }
          return;
        }

        // Check for stale data
        if (staleWhileRevalidate) {
          const staleData = cacheService.getStale<T>(key, {
            namespace,
            storage,
            staleGracePeriod,
          });
          if (staleData !== null) {
            if (mountedRef.current) {
              setData(staleData);
              setIsStale(true);
              setIsLoading(false);
            }
            // Continue to fetch fresh data
          }
        }
      }

      // Start fetching
      if (mountedRef.current) {
        setIsValidating(true);
        if (!data) setIsLoading(true);
      }

      lastFetchRef.current = now;

      // Create promise and store for deduplication
      const fetchPromise = (async (): Promise<T> => {
        try {
          const result = await fetcher();
          return result;
        } finally {
          pendingRequests.delete(pendingKey);
        }
      })();

      pendingRequests.set(pendingKey, fetchPromise);

      try {
        const result = await fetchPromise;

        // Cache the result
        const cacheOptions: CacheOptions = {
          ttl,
          namespace,
          storage,
          tags,
        };
        cacheService.set(key, result, cacheOptions);

        if (mountedRef.current) {
          setData(result);
          setError(null);
          setIsStale(false);
          retryCountRef.current = 0;
          onSuccess?.(result);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (mountedRef.current) {
          setError(error);

          // Retry logic
          if (retryCountRef.current < retryCount) {
            retryCountRef.current++;
            setTimeout(() => {
              fetchData(true);
            }, retryDelay * retryCountRef.current);
          } else {
            onError?.(error);
          }
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setIsValidating(false);
        }
      }
    },
    [
      key,
      enabled,
      namespace,
      storage,
      ttl,
      tags,
      fetcher,
      data,
      dedupeInterval,
      staleWhileRevalidate,
      staleGracePeriod,
      retryCount,
      retryDelay,
      onSuccess,
      onError,
    ]
  );

  // ============================================================
  // Revalidate Function
  // ============================================================

  const revalidate = useCallback(async (): Promise<void> => {
    retryCountRef.current = 0;
    await fetchData(true);
  }, [fetchData]);

  // ============================================================
  // Mutate Function
  // ============================================================

  const mutate = useCallback(
    (newData: T | ((current: T | undefined) => T)): void => {
      if (!key) return;

      const updatedData =
        typeof newData === 'function'
          ? (newData as (current: T | undefined) => T)(data)
          : newData;

      setData(updatedData);
      cacheService.set(key, updatedData, { ttl, namespace, storage, tags });
    },
    [key, data, ttl, namespace, storage, tags]
  );

  // ============================================================
  // Clear Function
  // ============================================================

  const clear = useCallback((): void => {
    if (!key) return;

    cacheService.delete(key, namespace);
    setData(initialData);
  }, [key, namespace, initialData]);

  // ============================================================
  // Effects
  // ============================================================

  // Initial fetch
  useEffect(() => {
    if (key && enabled) {
      fetchData();
    }
  }, [key, enabled, fetchData]); // Only re-run when key or enabled changes

  // Focus revalidation
  useEffect(() => {
    if (!revalidateOnFocus || !key || !enabled) return;

    const handleFocus = (): void => {
      revalidate();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [revalidateOnFocus, key, enabled, revalidate]);

  // Reconnect revalidation
  useEffect(() => {
    if (!revalidateOnReconnect || !key || !enabled) return;

    const handleOnline = (): void => {
      revalidate();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [revalidateOnReconnect, key, enabled, revalidate]);

  // Polling
  useEffect(() => {
    if (!refreshInterval || !key || !enabled) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    refreshIntervalRef.current = setInterval(() => {
      revalidate();
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [refreshInterval, key, enabled, revalidate]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    error,
    isLoading,
    isInitialLoading,
    isValidating,
    isStale,
    revalidate,
    mutate,
    clear,
  };
}

// ============================================================
// Preload Function
// ============================================================

/**
 * Preload data into cache
 * Useful for prefetching on hover or route change
 */
export async function preloadCacheQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { namespace, storage = 'memory' } = options;

  // Check if already cached
  const cached = cacheService.get<T>(key, { namespace, storage });
  if (cached !== null) {
    return cached;
  }

  // Check for pending request
  const pendingKey = `${namespace || ''}:${key}`;
  if (pendingRequests.has(pendingKey)) {
    return pendingRequests.get(pendingKey) as Promise<T>;
  }

  // Fetch and cache
  const fetchPromise = (async (): Promise<T> => {
    try {
      const data = await fetcher();
      cacheService.set(key, data, options);
      return data;
    } finally {
      pendingRequests.delete(pendingKey);
    }
  })();

  pendingRequests.set(pendingKey, fetchPromise);
  return fetchPromise;
}

// ============================================================
// Invalidate Function
// ============================================================

/**
 * Invalidate cache entries matching a pattern
 */
export function invalidateCacheQueries(
  pattern: string | RegExp,
  namespace?: string
): number {
  return cacheService.deletePattern(pattern, namespace);
}

/**
 * Invalidate cache entries by tag
 */
export function invalidateCacheQueriesByTag(tag: string): number {
  return cacheService.deleteByTag(tag);
}

export default useCacheQuery;
