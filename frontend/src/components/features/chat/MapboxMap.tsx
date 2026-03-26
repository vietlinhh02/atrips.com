'use client';

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import Map, {
  NavigationControl,
  ScaleControl,
  GeolocateControl,
  FullscreenControl,
  Marker,
  Popup,
  Source,
  Layer,
} from 'react-map-gl/mapbox';
import MapMarkerPopup from '@/src/components/features/trip/MapMarkerPopup';
import type { LayerProps } from 'react-map-gl/mapbox';
import useChatStore from '@/src/stores/chatStore';
import { useMapbox } from '@/src/hooks/useMapbox';
import type {
  SelectedDestination,
  ActivityData,
  ItineraryDayData,
} from '@/src/types/itinerary.types';

// Day color palette
const DAY_COLORS = [
  '#4F46E5', // indigo
  '#059669', // emerald
  '#D97706', // amber
  '#DC2626', // red
  '#7C3AED', // violet
  '#0891B2', // cyan
  '#BE185D', // pink
  '#65A30D', // lime
  '#EA580C', // orange
  '#6366F1', // slate-indigo
];

function getDayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length]!;
}

/** Transport modes treated as walking (dashed line). */
const WALKING_MODES = new Set([
  'walk', 'walking', 'on foot', 'foot', 'hike', 'hiking',
]);

function isWalkingSegment(mode?: string): boolean {
  if (!mode) return false;
  return WALKING_MODES.has(mode.toLowerCase().trim());
}

function getActivityImage(activity: ActivityData): string | undefined {
  const raw = activity as unknown as Record<string, unknown>;
  const photos = Array.isArray(raw.photos) ? raw.photos : [];
  const googleMapsInfo =
    activity.googleMapsInfo && typeof activity.googleMapsInfo === 'object'
      ? (activity.googleMapsInfo as unknown as Record<string, unknown>)
      : null;
  const googlePhotos =
    googleMapsInfo && Array.isArray(googleMapsInfo.photos)
      ? googleMapsInfo.photos
      : [];
  const candidates = [
    activity.image,
    activity.thumbnail,
    raw.imageUrl,
    raw.thumbnailUrl,
    ...photos,
    ...googlePhotos,
  ];
  const firstValid = candidates.find(
    (value) => typeof value === 'string' && value.startsWith('http'),
  );
  return typeof firstValid === 'string' ? firstValid : undefined;
}

interface ValidatedActivity {
  activity: ActivityData;
  lat: number;
  lng: number;
}

function validateCoordinates(
  activity: ActivityData,
): ValidatedActivity | null {
  const latRaw = activity.coordinates?.lat;
  const lngRaw = activity.coordinates?.lng;
  const lat = typeof latRaw === 'number' ? latRaw : Number(latRaw);
  const lng = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
  const isValid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
  if (!isValid) return null;
  return { activity, lat, lng };
}

interface DayRouteData {
  dayIndex: number;
  dayNumber: number;
  dayTitle: string;
  color: string;
  activities: ValidatedActivity[];
}

/** Build per-day route data from itinerary days. */
function buildDayRoutes(
  days: ItineraryDayData[] | undefined,
): DayRouteData[] {
  if (!days) return [];
  return days
    .map((day, idx) => {
      const activities = (day.activities || day.schedule || [])
        .map(validateCoordinates)
        .filter(
          (v): v is ValidatedActivity => v !== null,
        );
      return {
        dayIndex: idx,
        dayNumber: day.dayNumber ?? idx + 1,
        dayTitle: day.title || day.theme || `Day ${day.dayNumber ?? idx + 1}`,
        color: getDayColor(idx),
        activities,
      };
    })
    .filter((d) => d.activities.length > 0);
}

/** Build a straight-line fallback for a segment pair. */
function buildStraightSegment(
  route: DayRouteData,
  segmentIndex: number,
): GeoJSON.Feature<GeoJSON.LineString> {
  const from = route.activities[segmentIndex]!;
  const to = route.activities[segmentIndex + 1]!;
  const mode = to.activity.transportFromPrevious?.mode;
  return {
    type: 'Feature',
    properties: {
      dayIndex: route.dayIndex,
      segmentIndex,
      walking: isWalkingSegment(mode),
    },
    geometry: {
      type: 'LineString',
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    },
  };
}

// ────────────────────────────────────────────
// Mapbox Directions API — road-following routes
// ────────────────────────────────────────────

/** Cache key: "lng1,lat1;lng2,lat2|profile" */
const directionsCache: Record<string, number[][]> = {};

function directionsCacheKey(
  from: ValidatedActivity,
  to: ValidatedActivity,
  profile: string,
): string {
  return `${from.lng},${from.lat};${to.lng},${to.lat}|${profile}`;
}

function transportProfile(mode?: string): string {
  if (!mode) return 'driving';
  const m = mode.toLowerCase().trim();
  if (WALKING_MODES.has(m)) return 'walking';
  if (['cycle', 'cycling', 'bike', 'bicycle'].includes(m)) return 'cycling';
  return 'driving';
}

async function fetchDirectionsGeometry(
  from: ValidatedActivity,
  to: ValidatedActivity,
  accessToken: string,
  mode?: string,
): Promise<number[][] | null> {
  const profile = transportProfile(mode);
  const key = directionsCacheKey(from, to, profile);

  const cached = directionsCache[key];
  if (cached) return cached;

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=full&access_token=${accessToken}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const geometry = json?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(geometry) || geometry.length < 2) return null;

    directionsCache[key] = geometry;
    return geometry;
  } catch {
    return null;
  }
}

/** Fetch road-following geometries for all segments in a route. */
async function fetchRouteSegments(
  route: DayRouteData,
  accessToken: string,
): Promise<GeoJSON.Feature<GeoJSON.LineString>[]> {
  const promises = [];
  for (let i = 0; i < route.activities.length - 1; i++) {
    const from = route.activities[i]!;
    const to = route.activities[i + 1]!;
    const mode = to.activity.transportFromPrevious?.mode;
    promises.push(
      fetchDirectionsGeometry(from, to, accessToken, mode).then(
        (coords) => {
          const walking = isWalkingSegment(mode);
          if (coords) {
            return {
              type: 'Feature' as const,
              properties: {
                dayIndex: route.dayIndex,
                segmentIndex: i,
                walking,
              },
              geometry: {
                type: 'LineString' as const,
                coordinates: coords,
              },
            };
          }
          return buildStraightSegment(route, i);
        },
      ),
    );
  }
  return Promise.all(promises);
}

// ────────────────────────────────────────────
// Numbered marker element
// ────────────────────────────────────────────

interface NumberedMarkerProps {
  number: number;
  color: string;
  dimmed: boolean;
  label: string;
  onClick: () => void;
}

const NumberedMarker: React.FC<NumberedMarkerProps> = ({
  number,
  color,
  dimmed,
  label,
  onClick,
}) => (
  <div
    className="relative group cursor-pointer"
    style={{ opacity: dimmed ? 0.35 : 1, transition: 'opacity 0.3s' }}
    onClick={onClick}
  >
    <div
      className="flex items-center justify-center rounded-full shadow-md border-2 border-white"
      style={{
        width: 28,
        height: 28,
        backgroundColor: color,
        fontSize: 13,
        fontWeight: 700,
        color: '#fff',
        lineHeight: 1,
      }}
    >
      {number}
    </div>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
      <div className="bg-[var(--neutral-10)] text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap font-medium text-[var(--neutral-80)] max-w-[200px] truncate">
        {label}
      </div>
    </div>
  </div>
);

// ────────────────────────────────────────────
// Day legend
// ────────────────────────────────────────────

interface RouteLegendProps {
  routes: DayRouteData[];
  selectedDayNumber: number | null;
  onSelectDay: (dayNumber: number | null) => void;
}

const RouteLegend: React.FC<RouteLegendProps> = ({
  routes,
  selectedDayNumber,
  onSelectDay,
}) => {
  if (routes.length === 0) return null;

  return (
    <div className="absolute bottom-8 right-3 z-10 bg-[var(--neutral-10)]/95 backdrop-blur-sm rounded-lg shadow-md px-3 py-2 text-xs max-w-[180px]">
      <button
        type="button"
        className={`w-full text-left mb-1 px-1.5 py-1 rounded font-medium transition-colors ${
          selectedDayNumber === null
            ? 'bg-[var(--neutral-20)] text-[var(--neutral-100)]'
            : 'text-[var(--neutral-60)] hover:text-[var(--neutral-80)]'
        }`}
        onClick={() => onSelectDay(null)}
      >
        All days
      </button>
      {routes.map((route) => {
        const isActive =
          selectedDayNumber === null ||
          selectedDayNumber === route.dayNumber;
        return (
          <button
            key={route.dayIndex}
            type="button"
            className={`w-full text-left flex items-center gap-2 px-1.5 py-1 rounded transition-colors ${
              selectedDayNumber === route.dayNumber
                ? 'bg-[var(--neutral-20)] font-medium text-[var(--neutral-100)]'
                : 'text-[var(--neutral-60)] hover:text-[var(--neutral-80)]'
            }`}
            style={{ opacity: isActive ? 1 : 0.45 }}
            onClick={() =>
              onSelectDay(
                selectedDayNumber === route.dayNumber
                  ? null
                  : route.dayNumber,
              )
            }
          >
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: route.color }}
            />
            <span className="truncate">
              Day {route.dayNumber}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ────────────────────────────────────────────
// Route layers (one Source per day)
// ────────────────────────────────────────────

interface DayRouteLayerProps {
  route: DayRouteData;
  dimmed: boolean;
  accessToken: string;
}

const DayRouteLayer: React.FC<DayRouteLayerProps> = ({
  route,
  dimmed,
  accessToken,
}) => {
  // Start with straight-line fallbacks, then upgrade to road routes
  const straightSegments = useMemo(() => {
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    for (let i = 0; i < route.activities.length - 1; i++) {
      features.push(buildStraightSegment(route, i));
    }
    return features;
  }, [route]);

  const [segments, setSegments] = useState(straightSegments);

  useEffect(() => {
    setSegments(straightSegments);

    if (route.activities.length < 2) return;

    let cancelled = false;
    fetchRouteSegments(route, accessToken).then((routed) => {
      if (!cancelled) setSegments(routed);
    });
    return () => { cancelled = true; };
  }, [route, accessToken, straightSegments]);

  if (segments.length === 0) return null;

  const solidSegments = segments.filter((f) => !f.properties?.walking);
  const dashedSegments = segments.filter((f) => f.properties?.walking);

  const opacity = dimmed ? 0.15 : 0.85;
  const sourceIdSolid = `route-solid-day-${route.dayIndex}`;
  const sourceIdDashed = `route-dashed-day-${route.dayIndex}`;

  const solidLayerStyle: LayerProps = {
    id: `route-solid-layer-${route.dayIndex}`,
    type: 'line',
    paint: {
      'line-color': route.color,
      'line-width': 4,
      'line-opacity': opacity,
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
  };

  const dashedLayerStyle: LayerProps = {
    id: `route-dashed-layer-${route.dayIndex}`,
    type: 'line',
    paint: {
      'line-color': route.color,
      'line-width': 3.5,
      'line-opacity': opacity,
      'line-dasharray': [2, 2.5],
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
  };

  return (
    <>
      {solidSegments.length > 0 && (
        <Source
          id={sourceIdSolid}
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: solidSegments,
          }}
        >
          <Layer {...solidLayerStyle} />
        </Source>
      )}
      {dashedSegments.length > 0 && (
        <Source
          id={sourceIdDashed}
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: dashedSegments,
          }}
        >
          <Layer {...dashedLayerStyle} />
        </Source>
      )}
    </>
  );
};

// ────────────────────────────────────────────
// Bounds helper
// ────────────────────────────────────────────

function computeBounds(
  routes: DayRouteData[],
  selectedDayNumber: number | null,
): [[number, number], [number, number]] | null {
  const filtered =
    selectedDayNumber !== null
      ? routes.filter((r) => r.dayNumber === selectedDayNumber)
      : routes;

  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  let count = 0;

  for (const route of filtered) {
    for (const a of route.activities) {
      if (a.lat < minLat) minLat = a.lat;
      if (a.lat > maxLat) maxLat = a.lat;
      if (a.lng < minLng) minLng = a.lng;
      if (a.lng > maxLng) maxLng = a.lng;
      count++;
    }
  }

  if (count === 0) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

// ────────────────────────────────────────────
// MapboxMap component
// ────────────────────────────────────────────

interface MapboxMapProps {
  initialViewState?: {
    latitude: number;
    longitude: number;
    zoom: number;
  };
  onMarkerClick?: (dest: SelectedDestination) => void;
  onActivitySelect?: (activity: ActivityData) => void;
}

const MapboxMap: React.FC<MapboxMapProps> = ({
  initialViewState,
  onMarkerClick,
  onActivitySelect,
}) => {
  const setIsMapLoading = useChatStore((s) => s.setIsMapLoading);
  const currentItinerary = useChatStore((s) => s.currentItinerary);
  const selectedDayNumber = useChatStore((s) => s.selectedDayNumber);
  const setSelectedDayNumber = useChatStore((s) => s.setSelectedDayNumber);
  const [isMapLoaded, setIsMapLoaded] = React.useState(false);
  const [selectedMarker, setSelectedMarker] = useState<{
    activity: ActivityData;
    lat: number;
    lng: number;
  } | null>(null);

  const {
    isLoading: isConfigLoading,
    isEnabled,
    error,
    accessToken,
    style,
    defaultCenter,
    defaultZoom,
  } = useMapbox();

  const viewState = initialViewState || {
    latitude: defaultCenter[1],
    longitude: defaultCenter[0],
    zoom: defaultZoom,
  };

  useEffect(() => {
    setIsMapLoading(true);
  }, [setIsMapLoading]);

  // Build per-day route data
  const dayRoutes = useMemo(
    () => buildDayRoutes(currentItinerary?.days),
    [currentItinerary?.days],
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = React.useRef<any>(null);

  // Resize map when container changes (sidebar toggle)
  useEffect(() => {
    const handleResize = () => mapRef.current?.resize();
    window.addEventListener('map-resize', handleResize);
    return () => window.removeEventListener('map-resize', handleResize);
  }, []);

  // Fly to user's location when map loads and no itinerary is shown
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    if (currentItinerary) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 12,
          duration: 1200,
        });
      },
      () => {
        // Keep default center on denial/error
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, [isMapLoaded, currentItinerary]);

  // Fit bounds when routes change or day selection changes
  useEffect(() => {
    if (!isMapLoaded || !mapRef.current) return;
    const bounds = computeBounds(dayRoutes, selectedDayNumber);
    if (!bounds) return;

    mapRef.current.fitBounds(bounds, {
      padding: 60,
      duration: 800,
    });
  }, [dayRoutes, selectedDayNumber, isMapLoaded]);

  // Reset selected day when itinerary changes
  useEffect(() => {
    setSelectedDayNumber(null);
  }, [currentItinerary, setSelectedDayNumber]);

  const handleMarkerClick = useCallback(
    (activity: ActivityData, lat: number, lng: number) => {
      setSelectedMarker({ activity, lat, lng });
    },
    [],
  );

  if (isConfigLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[var(--neutral-20)] text-[var(--neutral-60)]">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-main)] mx-auto mb-2" />
          <p className="text-sm">Loading map configuration...</p>
        </div>
      </div>
    );
  }

  if (!isEnabled || !accessToken) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[var(--neutral-20)] text-[var(--neutral-60)]">
        <div className="text-center p-4">
          <p className="font-semibold">Map Unavailable</p>
          <p className="text-sm">
            {error || 'Map service is not available'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full relative">
      <Map
        ref={mapRef}
        mapboxAccessToken={accessToken}
        initialViewState={viewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle={style}
        attributionControl={true}
        onLoad={() => {
          setIsMapLoaded(true);
          setIsMapLoading(false);
        }}
        onError={(e) => {
          console.error('Map error:', e);
          setIsMapLoading(false);
        }}
      >
        <GeolocateControl position="top-right" />
        <FullscreenControl position="top-right" />
        <NavigationControl
          position="top-right"
          showCompass={true}
          showZoom={true}
        />
        <ScaleControl position="bottom-right" />

        {/* Route polylines (road-following via Directions API) */}
        {dayRoutes.map((route) => (
          <DayRouteLayer
            key={`route-${route.dayIndex}`}
            route={route}
            dimmed={
              selectedDayNumber !== null &&
              selectedDayNumber !== route.dayNumber
            }
            accessToken={accessToken}
          />
        ))}

        {/* Numbered markers */}
        {dayRoutes.map((route) => {
          const dimmed =
            selectedDayNumber !== null &&
            selectedDayNumber !== route.dayNumber;

          return route.activities.map((va, actIdx) => (
            <Marker
              key={`marker-d${route.dayIndex}-a${actIdx}`}
              latitude={va.lat}
              longitude={va.lng}
              anchor="center"
            >
              <NumberedMarker
                number={actIdx + 1}
                color={route.color}
                dimmed={dimmed}
                label={
                  va.activity.coordinates?.placeName ||
                  va.activity.location ||
                  va.activity.address ||
                  va.activity.title ||
                  va.activity.name
                }
                onClick={() =>
                  handleMarkerClick(va.activity, va.lat, va.lng)
                }
              />
            </Marker>
          ));
        })}

        {selectedMarker && (
          <Popup
            latitude={selectedMarker.lat}
            longitude={selectedMarker.lng}
            anchor="bottom"
            onClose={() => setSelectedMarker(null)}
            closeOnClick={false}
            className="map-popup"
          >
            <MapMarkerPopup
              name={
                selectedMarker.activity.coordinates?.placeName ||
                selectedMarker.activity.name
              }
              type={selectedMarker.activity.type}
              imageUrl={getActivityImage(selectedMarker.activity)}
              rating={selectedMarker.activity.googleMapsInfo?.rating ?? null}
              ratingCount={
                selectedMarker.activity.googleMapsInfo?.ratingCount ?? null
              }
              onViewDetails={() => {
                onActivitySelect?.(selectedMarker.activity);
                setSelectedMarker(null);
              }}
            />
          </Popup>
        )}
      </Map>

      {/* Day color legend */}
      {dayRoutes.length > 1 && (
        <RouteLegend
          routes={dayRoutes}
          selectedDayNumber={selectedDayNumber}
          onSelectDay={setSelectedDayNumber}
        />
      )}
    </div>
  );
};

export default MapboxMap;
