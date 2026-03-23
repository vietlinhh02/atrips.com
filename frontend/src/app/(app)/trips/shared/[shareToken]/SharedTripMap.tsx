'use client';

import { useEffect, useMemo, useRef } from 'react';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import { useMapbox } from '@/src/hooks/useMapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  dayNumber: number;
  index: number;
  color: string;
}

interface SharedTripMapProps {
  markers: MapMarker[];
}

export default function SharedTripMap({ markers }: SharedTripMapProps) {
  const { accessToken, style, isEnabled } = useMapbox();
  const mapRef = useRef<any>(null);

  const bounds = useMemo(() => {
    if (markers.length === 0) return null;
    let minLat = 90,
      maxLat = -90,
      minLng = 180,
      maxLng = -180;
    for (const m of markers) {
      if (m.lat < minLat) minLat = m.lat;
      if (m.lat > maxLat) maxLat = m.lat;
      if (m.lng < minLng) minLng = m.lng;
      if (m.lng > maxLng) maxLng = m.lng;
    }
    return {
      minLat,
      maxLat,
      minLng,
      maxLng,
    };
  }, [markers]);

  const initialViewState = useMemo(() => {
    if (!bounds) {
      return { latitude: 21.028, longitude: 105.854, zoom: 5 };
    }
    return {
      latitude: (bounds.minLat + bounds.maxLat) / 2,
      longitude: (bounds.minLng + bounds.maxLng) / 2,
      zoom: 11,
    };
  }, [bounds]);

  useEffect(() => {
    if (!mapRef.current || !bounds) return;
    const map = mapRef.current;
    try {
      map.fitBounds(
        [
          [bounds.minLng - 0.01, bounds.minLat - 0.01],
          [bounds.maxLng + 0.01, bounds.maxLat + 0.01],
        ],
        { padding: 60, duration: 800 },
      );
    } catch {
      // fitBounds may fail if map not ready
    }
  }, [bounds]);

  if (!isEnabled || !accessToken) {
    return (
      <div className="flex items-center justify-center h-full bg-[var(--neutral-20)] text-[var(--neutral-60)]">
        <p className="text-sm">Map unavailable</p>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={accessToken}
      initialViewState={initialViewState}
      style={{ width: '100%', height: '100%' }}
      mapStyle={style || 'mapbox://styles/mapbox/light-v11'}
      attributionControl={false}
    >
      <NavigationControl position="top-right" />

      {markers.map((m) => (
        <Marker
          key={m.id}
          latitude={m.lat}
          longitude={m.lng}
          anchor="center"
        >
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold shadow-md border-2 border-white cursor-pointer"
            style={{ backgroundColor: m.color }}
            title={m.name}
          >
            {m.index}
          </div>
        </Marker>
      ))}
    </Map>
  );
}
