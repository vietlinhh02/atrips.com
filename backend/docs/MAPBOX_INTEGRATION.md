# Mapbox Integration Guide

Hướng dẫn tích hợp Mapbox vào frontend ATrips với bảo mật và caching.

## 1. Backend API

### Endpoints

| Endpoint | Method | Auth | Mô tả |
|----------|--------|------|-------|
| `/api/config/map` | GET | Required | Lấy Mapbox config và token |

### Response Format

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "provider": "mapbox",
    "accessToken": "pk.eyJ1Ijoi...",
    "style": "mapbox://styles/mapbox/streets-v12",
    "options": {
      "defaultCenter": [106.6297, 10.8231],
      "defaultZoom": 12,
      "maxZoom": 18,
      "minZoom": 2
    }
  }
}
```

## 2. Frontend Integration

### 2.1 Cài đặt dependencies

```bash
# React với Mapbox GL
npm install mapbox-gl
npm install @types/mapbox-gl  # TypeScript

# Hoặc React Map GL (wrapper)
npm install react-map-gl mapbox-gl
```

### 2.2 Map Config Service với Cookie Caching

Tạo file `src/services/mapConfigService.ts`:

```typescript
// src/services/mapConfigService.ts

interface MapConfig {
  enabled: boolean;
  provider: string;
  accessToken: string;
  style: string;
  options: {
    defaultCenter: [number, number];
    defaultZoom: number;
    maxZoom: number;
    minZoom: number;
  };
}

const COOKIE_NAME = 'atrips_map_config';

class MapConfigService {
  private memoryCache: MapConfig | null = null;
  private fetchPromise: Promise<MapConfig> | null = null;

  /**
   * Get map config with caching (memory + cookie)
   */
  async getConfig(): Promise<MapConfig> {
    // 1. Check memory cache first (fastest)
    if (this.memoryCache) {
      return this.memoryCache;
    }

    // 2. Check cookie cache (set by backend, persists across reloads)
    const cookieConfig = this.getFromCookie();
    if (cookieConfig) {
      this.memoryCache = cookieConfig;
      return cookieConfig;
    }

    // 3. Prevent duplicate requests (dedup)
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // 4. Fetch from API (will also set cookie)
    this.fetchPromise = this.fetchFromAPI();

    try {
      const config = await this.fetchPromise;
      return config;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Fetch config from backend API
   * Backend will set cookie automatically
   */
  private async fetchFromAPI(): Promise<MapConfig> {
    try {
      const response = await fetch('/api/config/map', {
        method: 'GET',
        credentials: 'include', // Include cookies for auth
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to fetch map config: ${response.status}`);
      }

      const { data } = await response.json();

      // Cache in memory
      this.memoryCache = data;

      // Note: Cookie is set automatically by backend response

      return data;
    } catch (error) {
      console.error('Failed to fetch map config:', error);

      // Return disabled config on error
      return this.getDisabledConfig();
    }
  }

  /**
   * Get config from cookie
   */
  private getFromCookie(): MapConfig | null {
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === COOKIE_NAME && value) {
          const decoded = decodeURIComponent(value);
          return JSON.parse(decoded);
        }
      }
    } catch (e) {
      console.warn('Failed to parse map config from cookie:', e);
    }
    return null;
  }

  /**
   * Clear cache (call on logout)
   */
  clearCache(): void {
    this.memoryCache = null;
    // Clear cookie
    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }

  /**
   * Refresh cache (force fetch)
   */
  async refreshConfig(): Promise<MapConfig> {
    this.clearCache();
    return this.getConfig();
  }

  /**
   * Get disabled config (fallback)
   */
  private getDisabledConfig(): MapConfig {
    return {
      enabled: false,
      provider: 'mapbox',
      accessToken: '',
      style: '',
      options: {
        defaultCenter: [106.6297, 10.8231],
        defaultZoom: 12,
        maxZoom: 18,
        minZoom: 2,
      },
    };
  }

  /**
   * Check if config is available (sync check)
   */
  hasConfig(): boolean {
    return !!(this.memoryCache || this.getFromCookie());
  }

  /**
   * Get config synchronously (from cache only, no fetch)
   * Returns null if not cached
   */
  getConfigSync(): MapConfig | null {
    if (this.memoryCache) {
      return this.memoryCache;
    }
    const cookieConfig = this.getFromCookie();
    if (cookieConfig) {
      this.memoryCache = cookieConfig;
      return cookieConfig;
    }
    return null;
  }
}

// Export singleton instance
export const mapConfigService = new MapConfigService();
export default mapConfigService;
```

### 2.3 React Hook cho Mapbox

Tạo file `src/hooks/useMapbox.ts`:

```typescript
// src/hooks/useMapbox.ts

import { useState, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import mapConfigService from '../services/mapConfigService';

interface UseMapboxOptions {
  autoLoad?: boolean;
}

interface UseMapboxReturn {
  isLoading: boolean;
  isEnabled: boolean;
  error: string | null;
  accessToken: string | null;
  style: string;
  defaultCenter: [number, number];
  defaultZoom: number;
  initializeMap: (container: HTMLElement | string) => mapboxgl.Map | null;
  refreshConfig: () => Promise<void>;
}

export function useMapbox(options: UseMapboxOptions = {}): UseMapboxReturn {
  const { autoLoad = true } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [style, setStyle] = useState('mapbox://styles/mapbox/streets-v12');
  const [defaultCenter, setDefaultCenter] = useState<[number, number]>([106.6297, 10.8231]);
  const [defaultZoom, setDefaultZoom] = useState(12);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const config = await mapConfigService.getConfig();

      if (config.enabled && config.accessToken) {
        setIsEnabled(true);
        setAccessToken(config.accessToken);
        setStyle(config.style);
        setDefaultCenter(config.options.defaultCenter);
        setDefaultZoom(config.options.defaultZoom);

        // Set Mapbox access token globally
        mapboxgl.accessToken = config.accessToken;
      } else {
        setIsEnabled(false);
        setError('Map service is not available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map config');
      setIsEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadConfig();
    }
  }, [autoLoad, loadConfig]);

  const initializeMap = useCallback(
    (container: HTMLElement | string): mapboxgl.Map | null => {
      if (!isEnabled || !accessToken) {
        console.error('Mapbox is not enabled or configured');
        return null;
      }

      try {
        const map = new mapboxgl.Map({
          container,
          style,
          center: defaultCenter,
          zoom: defaultZoom,
        });

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add geolocation control
        map.addControl(
          new mapboxgl.GeolocateControl({
            positionOptions: {
              enableHighAccuracy: true,
            },
            trackUserLocation: true,
          }),
          'top-right'
        );

        return map;
      } catch (err) {
        console.error('Failed to initialize map:', err);
        return null;
      }
    },
    [isEnabled, accessToken, style, defaultCenter, defaultZoom]
  );

  const refreshConfig = useCallback(async () => {
    await mapConfigService.refreshConfig();
    await loadConfig();
  }, [loadConfig]);

  return {
    isLoading,
    isEnabled,
    error,
    accessToken,
    style,
    defaultCenter,
    defaultZoom,
    initializeMap,
    refreshConfig,
  };
}

export default useMapbox;
```

### 2.4 Map Component

Tạo file `src/components/Map/TripMap.tsx`:

```tsx
// src/components/Map/TripMap.tsx

import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useMapbox } from '../../hooks/useMapbox';

interface Activity {
  title: string;
  location: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  image?: string;
  type?: string;
}

interface TripMapProps {
  activities: Activity[];
  onActivityClick?: (activity: Activity) => void;
  className?: string;
}

export function TripMap({ activities, onActivityClick, className }: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const { isLoading, isEnabled, error, initializeMap } = useMapbox();
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !isEnabled || mapRef.current) return;

    const map = initializeMap(mapContainer.current);
    if (!map) return;

    mapRef.current = map;

    map.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [isEnabled, initializeMap]);

  // Add markers for activities
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Filter activities with coordinates
    const activitiesWithCoords = activities.filter(
      a => a.coordinates?.lat && a.coordinates?.lng
    );

    if (activitiesWithCoords.length === 0) return;

    // Add markers
    activitiesWithCoords.forEach((activity, index) => {
      const { lat, lng } = activity.coordinates!;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'trip-marker';
      el.innerHTML = `
        <div class="marker-pin" style="
          background: ${getMarkerColor(activity.type)};
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          <span style="
            transform: rotate(45deg);
            color: white;
            font-weight: bold;
            font-size: 12px;
          ">${index + 1}</span>
        </div>
      `;

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding: 8px; max-width: 200px;">
          ${activity.image ? `<img src="${activity.image}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" />` : ''}
          <h4 style="margin: 0 0 4px 0; font-size: 14px;">${activity.title}</h4>
          <p style="margin: 0; font-size: 12px; color: #666;">${activity.location}</p>
        </div>
      `);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapRef.current!);

      // Handle click
      if (onActivityClick) {
        el.addEventListener('click', () => onActivityClick(activity));
      }

      markersRef.current.push(marker);
    });

    // Fit bounds to show all markers
    if (activitiesWithCoords.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      activitiesWithCoords.forEach(a => {
        bounds.extend([a.coordinates!.lng, a.coordinates!.lat]);
      });
      mapRef.current.fitBounds(bounds, { padding: 50 });
    } else if (activitiesWithCoords.length === 1) {
      const { lat, lng } = activitiesWithCoords[0].coordinates!;
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14 });
    }
  }, [activities, mapLoaded, onActivityClick]);

  // Loading state
  if (isLoading) {
    return (
      <div className={`map-loading ${className}`} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f0f0',
        minHeight: 400,
      }}>
        <div>Loading map...</div>
      </div>
    );
  }

  // Error state
  if (error || !isEnabled) {
    return (
      <div className={`map-error ${className}`} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f0f0',
        minHeight: 400,
        color: '#666',
      }}>
        <div>
          <p>Map is not available</p>
          {error && <p style={{ fontSize: 12 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className={className}
      style={{ width: '100%', height: '400px' }}
    />
  );
}

// Helper function for marker colors
function getMarkerColor(type?: string): string {
  const colors: Record<string, string> = {
    attraction: '#FF5722',
    restaurant: '#4CAF50',
    hotel: '#2196F3',
    transport: '#9C27B0',
    activity: '#FF9800',
    shopping: '#E91E63',
    entertainment: '#00BCD4',
    cafe: '#795548',
  };
  return colors[type || 'attraction'] || '#FF5722';
}

export default TripMap;
```

### 2.5 Sử dụng trong Trip Detail

```tsx
// src/pages/TripDetail.tsx

import React from 'react';
import TripMap from '../components/Map/TripMap';

function TripDetail({ trip }) {
  // Flatten all activities from all days
  const allActivities = trip.days?.flatMap(day =>
    day.activities?.map(activity => ({
      ...activity,
      dayNumber: day.dayNumber,
    })) || []
  ) || [];

  return (
    <div className="trip-detail">
      <h1>{trip.title}</h1>

      {/* Map Section */}
      <section className="trip-map-section">
        <h2>Trip Map</h2>
        <TripMap
          activities={allActivities}
          onActivityClick={(activity) => {
            console.log('Clicked:', activity);
            // Scroll to activity, open modal, etc.
          }}
        />
      </section>

      {/* Itinerary Section */}
      <section className="trip-itinerary">
        {trip.days?.map(day => (
          <DayCard key={day.dayNumber} day={day} />
        ))}
      </section>
    </div>
  );
}
```

## 3. Caching Strategy (Cookie-based)

### 3.1 Cache Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend                              │
├─────────────────────────────────────────────────────────┤
│  1. Memory Cache (MapConfigService)                     │
│     - Fastest access                                    │
│     - Lost on page refresh                              │
├─────────────────────────────────────────────────────────┤
│  2. Cookie Cache (set by backend)                       │
│     - Persists across page reloads                      │
│     - TTL: 30 minutes (managed by backend)              │
│     - httpOnly: false (JS readable)                     │
│     - Automatically expires                             │
├─────────────────────────────────────────────────────────┤
│  3. API Request (deduplicated)                          │
│     - Only one concurrent request                       │
│     - Sets cookie automatically in response             │
│     - Updates memory cache                              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Cache Flow

```
getConfig() called
       │
       ▼
┌──────────────────┐
│ Check Memory     │──── Hit ────► Return cached
│ Cache            │
└────────┬─────────┘
         │ Miss
         ▼
┌──────────────────┐
│ Check Cookie     │──── Hit ────► Update memory
│ (atrips_map_     │               Return cached
│  config)         │
└────────┬─────────┘
         │ Miss (expired or not set)
         ▼
┌──────────────────┐
│ Check pending    │──── Yes ────► Wait for existing
│ request?         │               request
└────────┬─────────┘
         │ No
         ▼
┌──────────────────┐
│ Fetch from API   │
│ /api/config/map  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Backend sets     │
│ cookie in        │
│ response         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Update memory    │
│ Return config    │
└──────────────────┘
```

### 3.3 Cookie Details

Backend sets cookie với các options sau:
```javascript
res.cookie('atrips_map_config', JSON.stringify(mapConfig), {
  maxAge: 30 * 60 * 1000, // 30 minutes
  httpOnly: false,        // Allow JS to read
  secure: true,           // HTTPS only in production
  sameSite: 'strict',     // CSRF protection
  path: '/',
});
```

### 3.4 Clear Cache on Logout

```typescript
// src/services/authService.ts

import mapConfigService from './mapConfigService';

export async function logout() {
  // Clear auth tokens
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });

  // Clear map config cache (memory + cookie)
  mapConfigService.clearCache();

  // Redirect
  window.location.href = '/login';
}
```

### 3.5 Sync Access (No Network)

Vì cookie được lưu, bạn có thể access config synchronously:

```typescript
// Check if config available without fetching
if (mapConfigService.hasConfig()) {
  const config = mapConfigService.getConfigSync();
  // Use immediately
}

// Or use async version (recommended)
const config = await mapConfigService.getConfig();
```

### 3.6 Cookie Utils (Optional)

Nếu bạn muốn một utility chung để handle cookies:

```typescript
// src/utils/cookies.ts

export const cookies = {
  /**
   * Get a cookie by name
   */
  get(name: string): string | null {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  },

  /**
   * Get and parse JSON cookie
   */
  getJSON<T>(name: string): T | null {
    const value = this.get(name);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  },

  /**
   * Set a cookie
   */
  set(name: string, value: string, options: {
    maxAge?: number;
    path?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  } = {}): void {
    const { maxAge, path = '/', secure, sameSite = 'lax' } = options;
    let cookie = `${name}=${encodeURIComponent(value)}; path=${path}; sameSite=${sameSite}`;
    if (maxAge) cookie += `; max-age=${maxAge}`;
    if (secure) cookie += '; secure';
    document.cookie = cookie;
  },

  /**
   * Delete a cookie
   */
  delete(name: string, path: string = '/'): void {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
  },
};

// Usage example:
// const mapConfig = cookies.getJSON<MapConfig>('atrips_map_config');
```

## 4. Security Best Practices

### 4.1 Tạo Mapbox Public Token

1. Vào [Mapbox Account](https://account.mapbox.com/access-tokens/)
2. Click "Create a token"
3. Đặt tên: `atrips-frontend-public`
4. Chọn scopes cần thiết (styles:read, fonts:read, etc.)
5. **Quan trọng**: Add URL restrictions:
   - `https://atrips.com/*`
   - `https://*.atrips.com/*`
   - `http://localhost:3000/*` (for development)
6. Create token và copy

### 4.2 Environment Variables

```env
# Backend .env

# Full access token (for backend geocoding, etc.)
MAPBOX_ACCESS_TOKEN=sk.eyJ1IjoiYXRyaXBzIiwiYSI6...

# Restricted token for frontend (with URL restrictions)
MAPBOX_PUBLIC_TOKEN=pk.eyJ1IjoiYXRyaXBzIiwiYSI6...
```

### 4.3 Security Checklist

- [ ] Tạo separate token cho frontend với URL restrictions
- [ ] Token chỉ được cung cấp cho authenticated users
- [ ] Cache có TTL để token không bị stale
- [ ] Clear cache khi user logout
- [ ] Không hardcode token trong frontend code
- [ ] Backend token (sk.*) không bao giờ expose ra frontend

## 5. Error Handling

### 5.1 Token Expired/Invalid

```typescript
// Trong mapConfigService.ts

private async fetchFromAPI(): Promise<MapConfig> {
  try {
    const response = await fetch('/api/config/map', {
      credentials: 'include',
    });

    if (response.status === 401) {
      // Token expired, redirect to login
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // ...
  } catch (error) {
    // Log error for monitoring
    console.error('Map config fetch failed:', error);

    // Return disabled config
    return { enabled: false, /* ... */ };
  }
}
```

### 5.2 Map Load Error

```tsx
// Trong TripMap.tsx

useEffect(() => {
  if (!mapRef.current) return;

  mapRef.current.on('error', (e) => {
    console.error('Map error:', e);

    // Check if it's a token error
    if (e.error?.status === 401) {
      // Refresh config and retry
      refreshConfig();
    }
  });
}, [mapRef.current]);
```

## 6. Testing

### 6.1 Test Map Config Service

```typescript
// src/services/__tests__/mapConfigService.test.ts

import { mapConfigService } from '../mapConfigService';

describe('MapConfigService', () => {
  beforeEach(() => {
    mapConfigService.clearCache();
    localStorage.clear();
  });

  it('should cache config in memory', async () => {
    // First call - fetches from API
    const config1 = await mapConfigService.getConfig();
    expect(config1.enabled).toBe(true);

    // Second call - returns from memory cache
    const config2 = await mapConfigService.getConfig();
    expect(config2).toBe(config1); // Same reference
  });

  it('should deduplicate concurrent requests', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    // Multiple concurrent calls
    await Promise.all([
      mapConfigService.getConfig(),
      mapConfigService.getConfig(),
      mapConfigService.getConfig(),
    ]);

    // Should only make one API call
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
```

## 7. Monitoring

### 7.1 Track Map Usage

```typescript
// Analytics tracking
function trackMapEvent(event: string, data?: Record<string, any>) {
  // Send to analytics service
  analytics.track(`map_${event}`, {
    timestamp: Date.now(),
    ...data,
  });
}

// In TripMap component
useEffect(() => {
  if (mapLoaded) {
    trackMapEvent('loaded', {
      activitiesCount: activities.length,
      hasCoordinates: activities.filter(a => a.coordinates).length,
    });
  }
}, [mapLoaded]);
```

---

## Summary

1. **Backend** cung cấp endpoint `/api/config/map` chỉ cho authenticated users
2. **Frontend** sử dụng `MapConfigService` với 2 tầng cache (memory + localStorage)
3. **Security**: Tạo restricted token trong Mapbox dashboard với URL restrictions
4. **Cache TTL**: 30 phút, tự động refresh khi expired
5. **Logout**: Clear cache để đảm bảo token không bị lưu trữ
