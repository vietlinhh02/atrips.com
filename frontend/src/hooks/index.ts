/**
 * Hooks - Main Entry Point
 *
 * Export all custom hooks for easy importing.
 *
 * @example
 * ```tsx
 * import { useCacheQuery, useCache, useCachedState, useMapbox } from '@/hooks';
 *
 * // Use hooks in components
 * const { data, isLoading } = useCacheQuery('users', fetchUsers);
 * const [theme, setTheme] = useCachedState('theme', 'light');
 * const { accessToken, isEnabled } = useMapbox();
 * ```
 */

// Cache Query Hook
export {
  useCacheQuery,
  preloadCacheQuery,
  invalidateCacheQueries,
  invalidateCacheQueriesByTag,
} from './useCacheQuery';

// Basic Cache Hooks
export {
  useCache,
  useCachedState,
  useCacheStats,
  useCacheInvalidation,
} from './useCache';

// Mapbox Hook
export { useMapbox } from './useMapbox';

// Suggestions Hook
export { useSuggestions } from './useSuggestions';

// Keyboard Shortcuts Hook
export { useKeyboardShortcuts } from './useKeyboardShortcuts';

// Types
export type {
  UseCacheResult,
  UseCacheOptions,
} from './useCache';

export type { Suggestion } from './useSuggestions';

