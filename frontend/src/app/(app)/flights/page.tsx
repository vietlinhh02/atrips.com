'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AirplaneTakeoff,
  AirplaneLanding,
  MagnifyingGlass,
  Clock,
  Bell,
  ArrowRight,
  Trash,
  Pause,
  X,
  Warning,
  AirplaneTilt,
} from '@phosphor-icons/react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/src/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/src/components/ui/select';
import flightService from '@/src/services/flightService';
import type {
  FlightOffer,
  FlightTracking,
  FlightSearchHistoryEntry,
  FlightSearchResult,
} from '@/src/services/flightService';

function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const hours = match[1] ?? '0';
  const minutes = match[2] ?? '0';
  const parts: string[] = [];
  if (hours !== '0') parts.push(`${hours}h`);
  if (minutes !== '0') parts.push(`${minutes}m`);
  return parts.join(' ') || '0m';
}

function formatTime(isoDate: string): string {
  return format(new Date(isoDate), 'HH:mm');
}

function formatDate(isoDate: string): string {
  return format(new Date(isoDate), 'MMM d, yyyy');
}

function formatPrice(
  amount: string | number,
  currency: string
): string {
  const num =
    typeof amount === 'string' ? parseFloat(amount) : amount;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${num.toLocaleString()} ${currency}`;
  }
}

function clampIata(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}

const CABIN_CLASS_LABELS: Record<string, string> = {
  economy: 'Economy',
  premium_economy: 'Premium Economy',
  business: 'Business',
  first: 'First',
};

// -- Skeleton --

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-5 w-12 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-8 rounded bg-gray-100 animate-pulse" />
                <div className="h-5 w-12 rounded bg-gray-100 animate-pulse" />
              </div>
              <div className="h-7 w-24 rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-4 w-20 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-16 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-24 rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// -- Flight Card --

function FlightCard({
  offer,
  onTrackPrice,
}: {
  offer: FlightOffer;
  onTrackPrice: (offer: FlightOffer) => void;
}) {
  const outbound = offer.itineraries[0];
  if (!outbound) return null;

  const firstSegment = outbound.segments[0];
  const lastSegment = outbound.segments[outbound.segments.length - 1];
  if (!firstSegment || !lastSegment) return null;

  const totalStops = outbound.segments.reduce(
    (sum, seg) => sum + seg.numberOfStops,
    0
  );
  const stopCount =
    totalStops + (outbound.segments.length - 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)] hover:border-[var(--primary-main)] transition-colors"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 flex-1">
          {/* Route */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <AirplaneTakeoff
                size={16}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
              <span className="text-base font-semibold text-[var(--neutral-100)]">
                {firstSegment.departure.iataCode}
              </span>
              <span className="text-xs text-[var(--neutral-60)]">
                {formatTime(firstSegment.departure.at)}
              </span>
            </div>

            <ArrowRight
              size={14}
              className="text-[var(--neutral-50)]"
            />

            <div className="flex items-center gap-1.5">
              <AirplaneLanding
                size={16}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
              <span className="text-base font-semibold text-[var(--neutral-100)]">
                {lastSegment.arrival.iataCode}
              </span>
              <span className="text-xs text-[var(--neutral-60)]">
                {formatTime(lastSegment.arrival.at)}
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--neutral-60)]">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDuration(outbound.duration)}
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {stopCount === 0
                ? 'Nonstop'
                : `${stopCount} stop${stopCount > 1 ? 's' : ''}`}
            </Badge>
            {outbound.segments.map((seg, i) => (
              <span key={i} className="font-mono">
                {seg.carrierCode} {seg.number}
              </span>
            ))}
            {offer.numberOfBookableSeats !== undefined && (
              <span className="text-amber-600">
                {offer.numberOfBookableSeats} seat
                {offer.numberOfBookableSeats !== 1 ? 's' : ''} left
              </span>
            )}
          </div>

          {/* Return itinerary */}
          {offer.itineraries.length > 1 && offer.itineraries[1] && (
            <ReturnItinerarySummary
              itinerary={offer.itineraries[1]}
            />
          )}
        </div>

        {/* Price + Track */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-xl font-bold text-[var(--neutral-100)]">
            {formatPrice(
              offer.price.grandTotal,
              offer.price.currency
            )}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onTrackPrice(offer)}
            className="text-xs"
          >
            <Bell size={14} weight="duotone" className="mr-1" />
            Track Price
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function ReturnItinerarySummary({
  itinerary,
}: {
  itinerary: FlightOffer['itineraries'][number];
}) {
  const first = itinerary.segments[0];
  const last = itinerary.segments[itinerary.segments.length - 1];
  if (!first || !last) return null;

  return (
    <div className="flex items-center gap-3 mt-1 pt-2 border-t border-dashed border-[var(--neutral-30)]">
      <span className="text-xs text-[var(--neutral-60)]">
        Return:
      </span>
      <span className="text-sm font-medium text-[var(--neutral-100)]">
        {first.departure.iataCode}{' '}
        <span className="text-xs text-[var(--neutral-60)]">
          {formatTime(first.departure.at)}
        </span>
      </span>
      <ArrowRight size={12} className="text-[var(--neutral-50)]" />
      <span className="text-sm font-medium text-[var(--neutral-100)]">
        {last.arrival.iataCode}{' '}
        <span className="text-xs text-[var(--neutral-60)]">
          {formatTime(last.arrival.at)}
        </span>
      </span>
      <span className="text-xs text-[var(--neutral-60)]">
        {formatDuration(itinerary.duration)}
      </span>
    </div>
  );
}

// -- Track Price Modal --

function TrackPriceModal({
  offer,
  onClose,
  onCreated,
}: {
  offer: FlightOffer;
  onClose: () => void;
  onCreated: () => void;
}) {
  const outbound = offer.itineraries[0];
  const firstSeg = outbound?.segments[0];
  const lastSeg = outbound?.segments[outbound.segments.length - 1];

  const [priceThreshold, setPriceThreshold] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!firstSeg || !lastSeg) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await flightService.createTracking({
        origin: firstSeg.departure.iataCode,
        destination: lastSeg.arrival.iataCode,
        departDate: firstSeg.departure.at.split('T')[0]!,
        returnDate: returnDate || undefined,
        priceThreshold: priceThreshold
          ? Number(priceThreshold)
          : undefined,
        currency: offer.price.currency,
      });
      onCreated();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to create tracking';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md mx-4 rounded-[10px] border border-[var(--neutral-30)] bg-white p-6 shadow-lg"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--neutral-60)] hover:text-[var(--neutral-100)]"
        >
          <X size={20} />
        </button>

        <h3 className="text-lg font-semibold text-[var(--neutral-100)] mb-1">
          Track Price
        </h3>
        <p className="text-sm text-[var(--neutral-60)] mb-4">
          {firstSeg?.departure.iataCode} to{' '}
          {lastSeg?.arrival.iataCode} &middot;{' '}
          {formatPrice(
            offer.price.grandTotal,
            offer.price.currency
          )}
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--neutral-60)] mb-1">
              Alert me when price drops below (optional)
            </label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder={`e.g. ${offer.price.grandTotal}`}
              value={priceThreshold}
              onChange={(e) =>
                setPriceThreshold(e.target.value)
              }
              className="h-9"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--neutral-60)] mb-1">
              Return date (optional)
            </label>
            <Input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="h-9"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]"
            >
              {isSubmitting ? 'Creating...' : 'Start Tracking'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// -- Tracking Card --

function TrackingCard({
  tracking,
  onDeactivate,
  onDelete,
}: {
  tracking: FlightTracking;
  onDeactivate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-4 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--neutral-100)]">
              {tracking.origin}
            </span>
            <ArrowRight
              size={12}
              className="text-[var(--neutral-50)]"
            />
            <span className="text-sm font-semibold text-[var(--neutral-100)]">
              {tracking.destination}
            </span>
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${
                tracking.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tracking.isActive ? 'Active' : 'Paused'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--neutral-60)]">
            <span>{formatDate(tracking.departDate)}</span>
            {tracking.returnDate && (
              <span>Return: {formatDate(tracking.returnDate)}</span>
            )}
            {tracking.priceThreshold !== null && (
              <span>
                Threshold:{' '}
                {formatPrice(
                  tracking.priceThreshold,
                  tracking.currency
                )}
              </span>
            )}
            {tracking.lastPrice !== null && (
              <span className="font-medium text-[var(--neutral-100)]">
                Last:{' '}
                {formatPrice(
                  tracking.lastPrice,
                  tracking.currency
                )}
              </span>
            )}
            {tracking.lastCheckedAt && (
              <span>
                Checked: {formatDate(tracking.lastCheckedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tracking.isActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDeactivate(tracking.id)}
              className="text-xs"
            >
              <Pause size={14} className="mr-1" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(tracking.id)}
            className="text-xs text-red-600 hover:text-red-700 hover:border-red-300"
          >
            <Trash size={14} className="mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// -- History Item --

function HistoryItem({
  entry,
  onReSearch,
}: {
  entry: FlightSearchHistoryEntry;
  onReSearch: (entry: FlightSearchHistoryEntry) => void;
}) {
  return (
    <button
      onClick={() => onReSearch(entry)}
      className="w-full rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-4 text-left hover:border-[var(--primary-main)] transition-colors shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--neutral-100)]">
            {entry.origin}
          </span>
          <ArrowRight
            size={12}
            className="text-[var(--neutral-50)]"
          />
          <span className="text-sm font-semibold text-[var(--neutral-100)]">
            {entry.destination}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--neutral-60)]">
          <span>{formatDate(entry.departDate)}</span>
          {entry.returnDate && (
            <span>Return: {formatDate(entry.returnDate)}</span>
          )}
          <span>
            {entry.passengers} pax &middot;{' '}
            {CABIN_CLASS_LABELS[entry.cabinClass] ??
              entry.cabinClass}
          </span>
          <span>{formatDate(entry.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}

// -- Main Content --

function FlightsContent() {
  // Search form
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [cabinClass, setCabinClass] = useState('economy');

  // Search results
  const [searchResult, setSearchResult] =
    useState<FlightSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(
    null
  );

  // Track price modal
  const [trackingOffer, setTrackingOffer] =
    useState<FlightOffer | null>(null);

  // Price alerts
  const [trackings, setTrackings] = useState<FlightTracking[]>([]);
  const [trackingsLoaded, setTrackingsLoaded] = useState(false);

  // Search history
  const [history, setHistory] = useState<
    FlightSearchHistoryEntry[]
  >([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const handleSearch = useCallback(async () => {
    if (origin.length !== 3 || destination.length !== 3) {
      setSearchError('Enter valid 3-letter IATA codes');
      return;
    }
    if (!departDate) {
      setSearchError('Select a departure date');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const result = await flightService.searchFlights({
        origin,
        destination,
        departDate,
        returnDate: returnDate || undefined,
        passengers,
        cabinClass,
      });
      setSearchResult(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to search flights';
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  }, [
    origin,
    destination,
    departDate,
    returnDate,
    passengers,
    cabinClass,
  ]);

  const loadTrackings = useCallback(async () => {
    try {
      const result = await flightService.getTrackings();
      setTrackings(result.trackings);
    } catch {
      // Silent fail for background load
    } finally {
      setTrackingsLoaded(true);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const result = await flightService.getSearchHistory();
      setHistory(result.searches);
    } catch {
      // Silent fail for background load
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  const handleTabChange = (value: string) => {
    if (value === 'alerts' && !trackingsLoaded) {
      loadTrackings();
    }
    if (value === 'history' && !historyLoaded) {
      loadHistory();
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await flightService.deactivateTracking(id);
      setTrackings((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, isActive: false } : t
        )
      );
    } catch {
      // Error swallowed intentionally; user sees no state change
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await flightService.deleteTracking(id);
      setTrackings((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // Error swallowed intentionally; user sees no state change
    }
  };

  const handleReSearch = (entry: FlightSearchHistoryEntry) => {
    setOrigin(entry.origin);
    setDestination(entry.destination);
    setDepartDate(entry.departDate);
    setReturnDate(entry.returnDate ?? '');
    setPassengers(entry.passengers);
    setCabinClass(entry.cabinClass);
  };

  return (
    <div className="w-full px-4 md:px-6 py-6">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-5 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--neutral-60)]">
                Origin
              </label>
              <Input
                placeholder="CDG"
                maxLength={3}
                value={origin}
                onChange={(e) =>
                  setOrigin(clampIata(e.target.value))
                }
                className="h-9 font-mono uppercase"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--neutral-60)]">
                Destination
              </label>
              <Input
                placeholder="JFK"
                maxLength={3}
                value={destination}
                onChange={(e) =>
                  setDestination(clampIata(e.target.value))
                }
                className="h-9 font-mono uppercase"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--neutral-60)]">
                Depart
              </label>
              <Input
                type="date"
                value={departDate}
                onChange={(e) => setDepartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--neutral-60)]">
                Return
              </label>
              <Input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--neutral-60)]">
                Passengers
              </label>
              <Input
                type="number"
                min={1}
                max={9}
                value={passengers}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val >= 1 && val <= 9) setPassengers(val);
                }}
                className="h-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[var(--neutral-60)]">
                Cabin
              </label>
              <Select
                value={cabinClass}
                onValueChange={setCabinClass}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="economy">Economy</SelectItem>
                  <SelectItem value="premium_economy">
                    Premium Economy
                  </SelectItem>
                  <SelectItem value="business">
                    Business
                  </SelectItem>
                  <SelectItem value="first">First</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]"
            >
              <MagnifyingGlass size={16} weight="bold" />
              {isSearching ? 'Searching...' : 'Search Flights'}
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs
          defaultValue="search"
          onValueChange={handleTabChange}
        >
          <TabsList className="bg-[var(--neutral-20)]">
            <TabsTrigger value="search">
              <MagnifyingGlass
                size={14}
                className="mr-1.5"
              />
              Search
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell size={14} className="mr-1.5" />
              Price Alerts
            </TabsTrigger>
            <TabsTrigger value="history">
              <Clock size={14} className="mr-1.5" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search">
            <div className="flex flex-col gap-4 mt-4">
              {searchError && (
                <div className="flex items-center gap-2 rounded-[10px] border border-red-200 bg-red-50 p-4">
                  <Warning
                    size={16}
                    className="text-red-600 shrink-0"
                  />
                  <p className="text-sm text-red-600">
                    {searchError}
                  </p>
                </div>
              )}

              {isSearching && <SearchSkeleton />}

              {searchResult &&
                searchResult.flights.length === 0 && (
                  <div className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-8 py-16 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-surface)]">
                      <AirplaneTilt
                        size={32}
                        weight="duotone"
                        className="text-[var(--primary-main)]"
                      />
                    </div>
                    <h2 className="text-lg font-semibold text-[var(--neutral-100)]">
                      No flights found
                    </h2>
                    <p className="max-w-sm text-sm text-[var(--neutral-60)]">
                      {searchResult.message ??
                        'Try adjusting your search criteria or dates.'}
                    </p>
                  </div>
                )}

              {searchResult &&
                searchResult.flights.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-[var(--neutral-60)]">
                      {searchResult.flights.length} flight
                      {searchResult.flights.length !== 1
                        ? 's'
                        : ''}{' '}
                      found
                    </p>
                    {searchResult.flights.map((offer) => (
                      <FlightCard
                        key={offer.id}
                        offer={offer}
                        onTrackPrice={setTrackingOffer}
                      />
                    ))}
                  </div>
                )}

              {!isSearching && !searchResult && !searchError && (
                <div className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-8 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-surface)]">
                    <AirplaneTilt
                      size={32}
                      weight="duotone"
                      className="text-[var(--primary-main)]"
                    />
                  </div>
                  <h2 className="text-lg font-semibold text-[var(--neutral-100)]">
                    Search for flights
                  </h2>
                  <p className="max-w-sm text-sm text-[var(--neutral-60)]">
                    Enter your origin, destination, and travel
                    dates to find the best flight deals.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Price Alerts Tab */}
          <TabsContent value="alerts">
            <div className="flex flex-col gap-4 mt-4">
              {!trackingsLoaded && <SearchSkeleton />}

              {trackingsLoaded && trackings.length === 0 && (
                <div className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-8 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-surface)]">
                    <Bell
                      size={32}
                      weight="duotone"
                      className="text-[var(--primary-main)]"
                    />
                  </div>
                  <h2 className="text-lg font-semibold text-[var(--neutral-100)]">
                    No price alerts
                  </h2>
                  <p className="max-w-sm text-sm text-[var(--neutral-60)]">
                    Search for flights and click &quot;Track
                    Price&quot; to get notified when prices drop.
                  </p>
                </div>
              )}

              {trackingsLoaded && trackings.length > 0 && (
                <AnimatePresence mode="popLayout">
                  {trackings.map((tracking) => (
                    <TrackingCard
                      key={tracking.id}
                      tracking={tracking}
                      onDeactivate={handleDeactivate}
                      onDelete={handleDelete}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <div className="flex flex-col gap-3 mt-4">
              {!historyLoaded && <SearchSkeleton />}

              {historyLoaded && history.length === 0 && (
                <div className="flex flex-col items-center gap-4 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-8 py-16 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-surface)]">
                    <Clock
                      size={32}
                      weight="duotone"
                      className="text-[var(--primary-main)]"
                    />
                  </div>
                  <h2 className="text-lg font-semibold text-[var(--neutral-100)]">
                    No search history
                  </h2>
                  <p className="max-w-sm text-sm text-[var(--neutral-60)]">
                    Your flight searches will appear here.
                  </p>
                </div>
              )}

              {historyLoaded &&
                history.length > 0 &&
                history.map((entry) => (
                  <HistoryItem
                    key={entry.id}
                    entry={entry}
                    onReSearch={handleReSearch}
                  />
                ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Track Price Modal */}
        <AnimatePresence>
          {trackingOffer && (
            <TrackPriceModal
              offer={trackingOffer}
              onClose={() => setTrackingOffer(null)}
              onCreated={() => {
                setTrackingsLoaded(false);
                loadTrackings();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// -- Page --

export default function FlightsPage() {
  return <FlightsContent />;
}
