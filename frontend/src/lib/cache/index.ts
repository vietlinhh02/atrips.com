/**
 * Cache System - Main Entry Point
 *
 * Export all cache-related modules for easy importing.
 *
 * @example
 * ```ts
 * import { cacheService, CacheTTL, CacheNamespace } from '@/lib/cache';
 *
 * // Use cache service
 * cacheService.set('key', data, { ttl: CacheTTL.MEDIUM });
 * const cached = cacheService.get('key');
 * ```
 */

// Types
export * from './types';

// Cache Clients
export { MemoryCache, getMemoryCache } from './memoryCache';
export { StorageCache, getLocalStorageCache, getSessionStorageCache } from './storageCache';

// Main Cache Service
export { CacheService, getCacheService, cacheService } from './cacheService';

// Default export
export { cacheService as default } from './cacheService';
