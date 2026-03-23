'use client';

import { useCallback, useState } from 'react';
import {
  MagnifyingGlass,
  MapPin,
  Plus,
  X,
} from '@phosphor-icons/react';
import placeService from '@/src/services/placeService';
import tripService from '@/src/services/tripService';
import { toast } from '@/src/components/ui/use-toast';

interface AddActivityFormProps {
  tripId: string;
  dayId: string;
  cityLat?: number;
  cityLng?: number;
  onAdd: (activity: any) => void;
  onCancel: () => void;
}

export default function AddActivityForm({
  tripId,
  dayId,
  cityLat,
  cityLng,
  onAdd,
  onCancel,
}: AddActivityFormProps) {
  const [mode, setMode] = useState<'search' | 'custom'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customForm, setCustomForm] = useState({
    name: '',
    type: 'ACTIVITY',
    startTime: '',
    estimatedCost: '',
  });

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const places = await placeService.searchPlaces(
        query,
        cityLat,
        cityLng
      );
      setResults(places);
    } catch {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  }, [query, cityLat, cityLng]);

  const handleSelectPlace = useCallback(
    async (place: any) => {
      setSaving(true);
      try {
        const result = await tripService.addActivity(tripId, dayId, {
          name: place.name,
          placeId: place.id,
          latitude: place.latitude,
          longitude: place.longitude,
          customAddress: place.address,
          type: place.type || 'ACTIVITY',
        }) as Record<string, any>;
        onAdd(result.data?.activity ?? result);
        toast.success(`Added ${place.name}`);
      } catch {
        toast.error('Failed to add activity');
      } finally {
        setSaving(false);
      }
    },
    [tripId, dayId, onAdd]
  );

  const handleAddCustom = useCallback(async () => {
    if (!customForm.name.trim()) return;
    setSaving(true);
    try {
      const result = await tripService.addActivity(tripId, dayId, {
        name: customForm.name,
        type: customForm.type,
        startTime: customForm.startTime || undefined,
        estimatedCost: customForm.estimatedCost
          ? Number(customForm.estimatedCost)
          : undefined,
      }) as Record<string, any>;
      onAdd(result.data?.activity ?? result);
      toast.success(`Added ${customForm.name}`);
    } catch {
      toast.error('Failed to add activity');
    } finally {
      setSaving(false);
    }
  }, [customForm, tripId, dayId, onAdd]);

  return (
    <div className="rounded-lg border border-dashed border-[var(--neutral-40)] bg-[var(--neutral-15)] p-3 space-y-3">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('search')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            mode === 'search'
              ? 'bg-[var(--primary-main)] text-white'
              : 'bg-[var(--neutral-20)] text-[var(--neutral-60)]'
          }`}
        >
          <MagnifyingGlass size={12} className="inline mr-1" />
          Search places
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
            mode === 'custom'
              ? 'bg-[var(--primary-main)] text-white'
              : 'bg-[var(--neutral-20)] text-[var(--neutral-60)]'
          }`}
        >
          <Plus size={12} className="inline mr-1" />
          Custom activity
        </button>
      </div>

      {mode === 'search' ? (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for a place..."
              className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="rounded-md bg-[var(--primary-main)] px-3 py-1.5 text-xs text-white"
            >
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {results.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {results.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => handleSelectPlace(place)}
                  disabled={saving}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--neutral-20)] transition-colors"
                >
                  <MapPin
                    size={14}
                    className="shrink-0 text-[var(--neutral-60)]"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--neutral-100)] truncate">
                      {place.name}
                    </p>
                    <p className="text-[10px] text-[var(--neutral-60)] truncate">
                      {place.address}
                    </p>
                  </div>
                  {place.rating && (
                    <span className="text-[10px] text-[var(--neutral-60)]">
                      {place.rating}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <input
            type="text"
            value={customForm.name}
            onChange={(e) =>
              setCustomForm({ ...customForm, name: e.target.value })
            }
            placeholder="Activity name"
            className="w-full rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={customForm.startTime}
              onChange={(e) =>
                setCustomForm({
                  ...customForm,
                  startTime: e.target.value,
                })
              }
              className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
            />
            <input
              type="number"
              value={customForm.estimatedCost}
              onChange={(e) =>
                setCustomForm({
                  ...customForm,
                  estimatedCost: e.target.value,
                })
              }
              placeholder="Cost"
              className="flex-1 rounded-md border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={saving || !customForm.name.trim()}
            className="w-full rounded-md bg-[var(--primary-main)] py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Activity'}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="flex w-full items-center justify-center gap-1 text-xs text-[var(--neutral-60)] hover:text-[var(--neutral-80)]"
      >
        <X size={12} />
        Cancel
      </button>
    </div>
  );
}
