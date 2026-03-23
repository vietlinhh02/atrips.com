/**
 * Cache System Examples
 *
 * Practical examples for common use cases.
 * Copy and adapt these patterns for your components.
 */

'use client';

import React from 'react';
import { useCacheQuery, useCachedState, useCache, useCacheInvalidation } from '../../hooks';
import { cacheService, CacheTTL, CacheNamespace } from './index';

// ============================================================
// Example 1: User Profile with Caching
// ============================================================

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

async function fetchUserProfile(): Promise<User> {
  const response = await fetch('/api/users/profile');
  return response.json();
}

export function UserProfileExample() {
  const {
    data: user,
    error,
    isLoading,
    isValidating,
    revalidate,
  } = useCacheQuery<User>('user:profile', fetchUserProfile, {
    ttl: CacheTTL.MEDIUM,
    namespace: CacheNamespace.USERS,
    storage: 'localStorage',
    revalidateOnFocus: true,
    staleWhileRevalidate: true,
  });

  if (isLoading) {
    return <div className="animate-pulse">Loading profile...</div>;
  }

  if (error) {
    return (
      <div className="text-red-500">
        Error: {error.message}
        <button onClick={revalidate} className="ml-2 text-blue-500">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-center gap-4">
        {user?.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.name}
            className="w-12 h-12 rounded-full"
          />
        )}
        <div>
          <h2 className="font-bold">{user?.name}</h2>
          <p className="text-gray-500">{user?.email}</p>
        </div>
      </div>
      {isValidating && (
        <span className="text-xs text-gray-400">Refreshing...</span>
      )}
      <button
        onClick={revalidate}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Refresh Profile
      </button>
    </div>
  );
}

// ============================================================
// Example 2: Theme Toggle with Persistence
// ============================================================

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggleExample() {
  const [theme, setTheme] = useCachedState<Theme>('app:theme', 'system', {
    storage: 'localStorage',
    ttl: CacheTTL.WEEK,
    namespace: CacheNamespace.SETTINGS,
  });

  const themes: Theme[] = ['light', 'dark', 'system'];

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">Theme Settings</h3>
      <div className="flex gap-2">
        {themes.map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={`px-4 py-2 rounded ${
              theme === t
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <p className="mt-4 text-gray-500">
        Current theme: <strong>{theme}</strong>
        <br />
        <span className="text-xs">Persists across browser sessions</span>
      </p>
    </div>
  );
}

// ============================================================
// Example 3: Search with Debounced Caching
// ============================================================

interface SearchResult {
  id: string;
  title: string;
  description: string;
}

async function searchPlaces(query: string): Promise<SearchResult[]> {
  const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
  return response.json();
}

export function SearchExample() {
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');

  // Debounce the query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Only fetch when we have a query
  const cacheKey = debouncedQuery ? `search:${debouncedQuery}` : null;

  const { data: results, isLoading } = useCacheQuery<SearchResult[]>(
    cacheKey,
    () => searchPlaces(debouncedQuery),
    {
      ttl: CacheTTL.LONG, // Cache search results for 30 minutes
      namespace: CacheNamespace.PLACES,
      storage: 'memory',
      enabled: !!debouncedQuery,
    }
  );

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">Search Places</h3>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for places..."
        className="w-full px-4 py-2 border rounded"
      />

      {isLoading && <div className="mt-4">Searching...</div>}

      {results && results.length > 0 && (
        <ul className="mt-4 space-y-2">
          {results.map((result) => (
            <li key={result.id} className="p-2 bg-gray-50 rounded">
              <strong>{result.title}</strong>
              <p className="text-sm text-gray-500">{result.description}</p>
            </li>
          ))}
        </ul>
      )}

      {results && results.length === 0 && debouncedQuery && (
        <p className="mt-4 text-gray-500">No results found</p>
      )}
    </div>
  );
}

// ============================================================
// Example 4: Form with Draft Saving
// ============================================================

interface TripDraft {
  title: string;
  destination: string;
  startDate: string;
  notes: string;
}

const emptyDraft: TripDraft = {
  title: '',
  destination: '',
  startDate: '',
  notes: '',
};

export function TripFormWithDraftExample() {
  const { value: draft, set: saveDraft, remove: clearDraft } = useCache<TripDraft>(
    'trip:draft',
    {
      namespace: CacheNamespace.TRIPS,
      storage: 'localStorage',
    }
  );

  const [form, setForm] = React.useState<TripDraft>(draft || emptyDraft);

  // Auto-save draft every 2 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (form.title || form.destination || form.notes) {
        saveDraft(form, { ttl: CacheTTL.DAY });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [form, saveDraft]);

  const handleChange = (field: keyof TripDraft, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Submit form...
    console.log('Submitting:', form);
    // Clear draft on success
    clearDraft();
    setForm(emptyDraft);
  };

  const handleClearDraft = () => {
    clearDraft();
    setForm(emptyDraft);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border rounded-lg space-y-4">
      <h3 className="font-bold">Plan a Trip</h3>
      {draft && (
        <div className="text-sm text-green-600">
          Draft restored!{' '}
          <button
            type="button"
            onClick={handleClearDraft}
            className="text-red-500 underline"
          >
            Clear
          </button>
        </div>
      )}

      <input
        type="text"
        value={form.title}
        onChange={(e) => handleChange('title', e.target.value)}
        placeholder="Trip Title"
        className="w-full px-4 py-2 border rounded"
      />

      <input
        type="text"
        value={form.destination}
        onChange={(e) => handleChange('destination', e.target.value)}
        placeholder="Destination"
        className="w-full px-4 py-2 border rounded"
      />

      <input
        type="date"
        value={form.startDate}
        onChange={(e) => handleChange('startDate', e.target.value)}
        className="w-full px-4 py-2 border rounded"
      />

      <textarea
        value={form.notes}
        onChange={(e) => handleChange('notes', e.target.value)}
        placeholder="Notes..."
        className="w-full px-4 py-2 border rounded"
        rows={3}
      />

      <button
        type="submit"
        className="w-full py-2 bg-blue-500 text-white rounded"
      >
        Create Trip
      </button>
    </form>
  );
}

// ============================================================
// Example 5: Prefetching on Hover
// ============================================================

import { preloadCacheQuery } from '../../hooks/useCacheQuery';

interface Trip {
  id: string;
  title: string;
  destination: string;
}

async function fetchTrip(id: string): Promise<Trip> {
  const response = await fetch(`/api/trips/${id}`);
  return response.json();
}

export function TripListWithPrefetchExample() {
  const trips = [
    { id: '1', title: 'Paris Adventure' },
    { id: '2', title: 'Tokyo Trip' },
    { id: '3', title: 'New York Weekend' },
  ];

  const handleMouseEnter = (tripId: string) => {
    // Prefetch trip data on hover
    preloadCacheQuery(
      `trip:${tripId}`,
      () => fetchTrip(tripId),
      {
        ttl: CacheTTL.MEDIUM,
        namespace: CacheNamespace.TRIPS,
      }
    );
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">My Trips</h3>
      <p className="text-sm text-gray-500 mb-4">
        Hover over a trip to prefetch its data
      </p>
      <ul className="space-y-2">
        {trips.map((trip) => (
          <li key={trip.id}>
            <a
              href={`/trips/${trip.id}`}
              onMouseEnter={() => handleMouseEnter(trip.id)}
              className="block p-3 bg-gray-50 rounded hover:bg-gray-100 transition"
            >
              {trip.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Example 6: Optimistic Update
// ============================================================

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

async function fetchTodos(): Promise<Todo[]> {
  const response = await fetch('/api/todos');
  return response.json();
}

async function updateTodo(todo: Todo): Promise<Todo> {
  const response = await fetch(`/api/todos/${todo.id}`, {
    method: 'PATCH',
    body: JSON.stringify(todo),
  });
  return response.json();
}

export function OptimisticUpdateExample() {
  const { data: todos, mutate } = useCacheQuery<Todo[]>('todos', fetchTodos, {
    ttl: CacheTTL.SHORT,
    namespace: CacheNamespace.API,
  });

  const handleToggle = async (todo: Todo) => {
    const updatedTodo = { ...todo, completed: !todo.completed };

    // Optimistic update
    mutate((current) =>
      (current ?? []).map((t) => (t.id === todo.id ? updatedTodo : t))
    );

    try {
      await updateTodo(updatedTodo);
    } catch {
      // Revert on error
      mutate((current) =>
        (current ?? []).map((t) => (t.id === todo.id ? todo : t))
      );
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">Todos (Optimistic Update)</h3>
      <ul className="space-y-2">
        {todos?.map((todo) => (
          <li key={todo.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => handleToggle(todo)}
              className="w-4 h-4"
            />
            <span className={todo.completed ? 'line-through text-gray-400' : ''}>
              {todo.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Example 7: Cache Admin Panel
// ============================================================

import { useCacheStats } from '../../hooks/useCache';

export function CacheAdminExample() {
  const stats = useCacheStats(1000); // Refresh every second
  const { invalidateAll } = useCacheInvalidation();

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">Cache Statistics</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-gray-50 rounded">
          <div className="text-2xl font-bold text-blue-600">
            {(stats.hitRatio * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Hit Ratio</div>
        </div>

        <div className="p-3 bg-gray-50 rounded">
          <div className="text-2xl font-bold text-green-600">
            {stats.totalEntries}
          </div>
          <div className="text-sm text-gray-500">Total Entries</div>
        </div>

        <div className="p-3 bg-gray-50 rounded">
          <div className="text-2xl font-bold text-purple-600">
            {stats.hits}
          </div>
          <div className="text-sm text-gray-500">Cache Hits</div>
        </div>

        <div className="p-3 bg-gray-50 rounded">
          <div className="text-2xl font-bold text-orange-600">
            {stats.misses}
          </div>
          <div className="text-sm text-gray-500">Cache Misses</div>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium mb-2">Storage Usage</h4>
        <div className="text-sm">
          <span>Memory: {stats.memoryEntries} entries</span>
          <br />
          <span>localStorage: {stats.localStorageEntries} entries</span>
          <br />
          <span>Total Size: {formatBytes(stats.totalSize)}</span>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="font-medium mb-2">By Namespace</h4>
        <div className="text-sm space-y-1">
          {Object.entries(stats.byNamespace).map(([ns, count]) => (
            <div key={ns} className="flex justify-between">
              <span>{ns}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => invalidateAll()}
          className="px-4 py-2 bg-red-500 text-white rounded text-sm"
        >
          Clear All Cache
        </button>
        <button
          onClick={() => {
            cacheService.cleanup();
          }}
          className="px-4 py-2 bg-yellow-500 text-white rounded text-sm"
        >
          Cleanup Expired
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Example 8: Conditional Caching
// ============================================================

export function ConditionalCacheExample() {
  const [bypassCache, setBypassCache] = React.useState(false);

  const { data, isLoading, revalidate } = useCacheQuery<User>(
    bypassCache ? null : 'user:profile', // null key disables caching
    fetchUserProfile,
    {
      ttl: CacheTTL.MEDIUM,
      enabled: true,
    }
  );

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">Conditional Caching</h3>

      <label className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={bypassCache}
          onChange={(e) => setBypassCache(e.target.checked)}
        />
        <span>Bypass Cache (always fetch fresh)</span>
      </label>

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div>
          <p>User: {data?.name}</p>
          <button onClick={revalidate} className="mt-2 text-blue-500">
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Example 9: Multi-level Cache (Memory + Storage)
// ============================================================

export function MultiLevelCacheExample() {
  const handleSetData = () => {
    // Set in both memory (fast) and localStorage (persistent)
    const data = { timestamp: Date.now(), value: 'test' };

    // Memory cache for fast access
    cacheService.set('multi:data', data, {
      storage: 'memory',
      ttl: CacheTTL.SHORT,
    });

    // localStorage for persistence
    cacheService.set('multi:data', data, {
      storage: 'localStorage',
      ttl: CacheTTL.LONG,
    });

    console.log('Data cached in both memory and localStorage');
  };

  const handleGetData = () => {
    // Will check memory first (fast), then localStorage (persistent)
    const data = cacheService.get('multi:data', { storage: 'memory' });

    if (data) {
      console.log('From memory:', data);
    } else {
      const persistedData = cacheService.get('multi:data', { storage: 'localStorage' });
      console.log('From localStorage:', persistedData);
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">Multi-Level Cache</h3>
      <p className="text-sm text-gray-500 mb-4">
        Uses memory for speed, localStorage for persistence
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleSetData}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Set Data
        </button>
        <button
          onClick={handleGetData}
          className="px-4 py-2 bg-green-500 text-white rounded"
        >
          Get Data (check console)
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Example 10: API Response Caching
// ============================================================

async function fetchWithCache<T>(
  endpoint: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  // Check cache first
  const cached = cacheService.getApiResponse<T>(endpoint, params);
  if (cached !== null) {
    return cached;
  }

  // Fetch from API
  const queryString = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const url = queryString ? `${endpoint}?${queryString}` : endpoint;

  const response = await fetch(url);
  const data = await response.json();

  // Cache response
  cacheService.setApiResponse(endpoint, params, data, CacheTTL.SHORT);

  return data;
}

export function ApiCacheExample() {
  const [data, setData] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleFetch = async () => {
    setLoading(true);
    try {
      const result = await fetchWithCache<Record<string, unknown>>('/api/data', { page: 1, limit: 10 });
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  const handleInvalidate = () => {
    cacheService.invalidateApiEndpoint('/api/data');
    console.log('API cache invalidated');
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-bold mb-4">API Response Caching</h3>
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleFetch}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Fetch Data'}
        </button>
        <button
          onClick={handleInvalidate}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Invalidate Cache
        </button>
      </div>
      {data && (
        <pre className="p-2 bg-gray-100 rounded text-sm overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
