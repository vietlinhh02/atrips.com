'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import {
  MagnifyingGlass,
  MapPin,
  CalendarBlank,
  Ticket,
  Tag,
  ArrowSquareOut,
  MusicNotes,
  Trophy,
  PaintBrush,
  UsersThree,
  Smiley,
  FilmStrip,
  Hamburger,
  Books,
  Confetti,
} from '@phosphor-icons/react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import eventService from '@/src/services/eventService';
import type {
  LocalEvent,
  EventPagination,
} from '@/src/services/eventService';

// ============================================
// Constants
// ============================================

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Music', value: 'Music' },
  { label: 'Sports', value: 'Sports' },
  { label: 'Arts', value: 'Arts' },
  { label: 'Family', value: 'Family' },
  { label: 'Comedy', value: 'Comedy' },
  { label: 'Film', value: 'Film' },
  { label: 'Food', value: 'Food' },
  { label: 'Education', value: 'Education' },
] as const;

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Music: MusicNotes,
  Sports: Trophy,
  Arts: PaintBrush,
  Family: UsersThree,
  Comedy: Smiley,
  Film: FilmStrip,
  Food: Hamburger,
  Education: Books,
};

const GRADIENT_PLACEHOLDERS = [
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-400 to-rose-500',
  'from-violet-500 to-purple-600',
  'from-cyan-400 to-blue-500',
  'from-pink-500 to-rose-600',
];

function getGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % GRADIENT_PLACEHOLDERS.length;
  return GRADIENT_PLACEHOLDERS[index] ?? GRADIENT_PLACEHOLDERS[0];
}

// ============================================
// Event Card
// ============================================

function EventCard({
  event,
  index,
  onSelect,
}: {
  event: LocalEvent;
  index: number;
  onSelect: (event: LocalEvent) => void;
}) {
  const startDate = parseISO(event.startTime);
  const CategoryIcon =
    CATEGORY_ICONS[event.category ?? ''] ?? Confetti;

  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      onClick={() => onSelect(event)}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)] transition-all hover:border-[var(--primary-main)] hover:shadow-md text-left cursor-pointer"
    >
      {/* Image / Gradient Placeholder */}
      <div className="relative h-40 w-full overflow-hidden">
        {event.imageUrl ? (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${getGradient(event.id)}`}
          >
            <CategoryIcon
              size={48}
              weight="duotone"
              className="text-white/60"
            />
          </div>
        )}

        {/* Category Badge */}
        {event.category && (
          <Badge className="absolute left-3 top-3 bg-white/90 text-neutral-800 text-[11px] font-medium backdrop-blur-sm hover:bg-white/90">
            <Tag size={12} weight="bold" className="mr-1" />
            {event.category}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-[var(--neutral-100)] group-hover:text-[var(--primary-main)] transition-colors leading-snug">
          {event.title}
        </h3>

        <div className="flex items-center gap-1.5 text-xs text-[var(--neutral-60)]">
          <CalendarBlank size={14} weight="regular" />
          <span>{format(startDate, 'EEE, MMM d, yyyy')}</span>
          <span className="text-[var(--neutral-40)]">|</span>
          <span>{format(startDate, 'h:mm a')}</span>
        </div>

        {event.venue && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--neutral-60)]">
            <MapPin size={14} weight="regular" />
            <span className="truncate">{event.venue}</span>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--neutral-50)]">
            {event.city}
            {event.countryCode ? `, ${event.countryCode}` : ''}
          </span>
          {event.priceRange && (
            <Badge
              variant="secondary"
              className="bg-[var(--primary-surface)] text-[var(--primary-main)] text-[11px] font-medium hover:bg-[var(--primary-surface)]"
            >
              <Ticket size={12} weight="bold" className="mr-1" />
              {event.priceRange}
            </Badge>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ============================================
// Event Detail Modal
// ============================================

function EventDetailModal({
  event,
  onClose,
}: {
  event: LocalEvent;
  onClose: () => void;
}) {
  const startDate = parseISO(event.startTime);
  const endDate = event.endTime ? parseISO(event.endTime) : null;
  const CategoryIcon =
    CATEGORY_ICONS[event.category ?? ''] ?? Confetti;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--neutral-10)] shadow-2xl"
      >
        {/* Image / Gradient Header */}
        <div className="relative h-52 w-full overflow-hidden">
          {event.imageUrl ? (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${getGradient(event.id)}`}
            >
              <CategoryIcon
                size={64}
                weight="duotone"
                className="text-white/60"
              />
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-6">
          {event.category && (
            <Badge className="w-fit bg-[var(--primary-surface)] text-[var(--primary-main)] hover:bg-[var(--primary-surface)]">
              <Tag size={12} weight="bold" className="mr-1" />
              {event.category}
            </Badge>
          )}

          <h2 className="text-xl font-semibold text-[var(--neutral-100)] leading-tight">
            {event.title}
          </h2>

          {/* Date / Time */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm text-[var(--neutral-70)]">
              <CalendarBlank
                size={16}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
              <span>
                {format(startDate, 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--neutral-70)]">
              <CalendarBlank
                size={16}
                weight="duotone"
                className="text-[var(--primary-main)] opacity-0"
              />
              <span>
                {format(startDate, 'h:mm a')}
                {endDate
                  ? ` - ${format(endDate, 'h:mm a')}`
                  : ''}
              </span>
            </div>
          </div>

          {/* Venue / Address */}
          {(event.venue ?? event.address) && (
            <div className="flex items-start gap-2 text-sm text-[var(--neutral-70)]">
              <MapPin
                size={16}
                weight="duotone"
                className="mt-0.5 shrink-0 text-[var(--primary-main)]"
              />
              <div className="flex flex-col">
                {event.venue && (
                  <span className="font-medium">
                    {event.venue}
                  </span>
                )}
                {event.address && (
                  <span className="text-[var(--neutral-50)]">
                    {event.address}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Price */}
          {event.priceRange && (
            <div className="flex items-center gap-2 text-sm text-[var(--neutral-70)]">
              <Ticket
                size={16}
                weight="duotone"
                className="text-[var(--primary-main)]"
              />
              <span>{event.priceRange}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <p className="text-sm leading-relaxed text-[var(--neutral-60)]">
              {event.description}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {event.ticketUrl && (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary-main)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
              >
                <Ticket size={16} weight="bold" />
                Get Tickets
                <ArrowSquareOut size={14} />
              </a>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 rounded-lg"
            >
              Close
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function EventsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)]"
        >
          <div className="h-40 w-full animate-pulse bg-gray-100" />
          <div className="flex flex-col gap-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
            <div className="mt-2 flex justify-between">
              <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
              <div className="h-5 w-16 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Empty State
// ============================================

function EmptyState({ city }: { city: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center gap-4 rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-8 py-16 text-center shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-surface)]">
        <Confetti
          size={32}
          weight="duotone"
          className="text-[var(--primary-main)]"
        />
      </div>
      <h2 className="text-lg font-semibold text-[var(--neutral-100)]">
        No events found
      </h2>
      <p className="max-w-sm text-sm text-[var(--neutral-60)]">
        {city
          ? `We couldn't find any events in "${city}" for the selected dates. Try adjusting your search criteria.`
          : 'Search for a city to discover local events, concerts, sports, and more.'}
      </p>
    </motion.div>
  );
}

// ============================================
// Events Content
// ============================================

function EventsContent() {
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [pagination, setPagination] =
    useState<EventPagination | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] =
    useState<LocalEvent | null>(null);

  const searchEvents = useCallback(
    async (page = 1, append = false) => {
      if (!city.trim()) return;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await eventService.searchEvents({
          city: city.trim(),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          category: activeCategory || undefined,
          page,
          limit: 20,
        });
        setEvents(
          append
            ? (prev) => [...prev, ...result.events]
            : result.events,
        );
        setPagination(result.pagination);
        setHasSearched(true);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to load events';
        setError(message);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [city, startDate, endDate, activeCategory],
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      searchEvents(1, false);
    },
    [searchEvents],
  );

  const handleLoadMore = useCallback(() => {
    if (!pagination?.hasMore || isLoadingMore) return;
    searchEvents(pagination.page + 1, true);
  }, [pagination, isLoadingMore, searchEvents]);

  useEffect(() => {
    if (hasSearched && city.trim()) {
      searchEvents(1, false);
    }
    // Only re-search when category changes after initial search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  return (
    <div className="w-full px-4 py-6 md:px-6">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
        {/* Search Bar */}
        <motion.form
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onSubmit={handleSearch}
          className="flex flex-col gap-3 rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-4 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)] sm:flex-row sm:items-end"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <label
              htmlFor="event-city"
              className="text-xs font-medium text-[var(--neutral-60)]"
            >
              City
            </label>
            <div className="relative">
              <MapPin
                size={16}
                weight="regular"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-50)]"
              />
              <Input
                id="event-city"
                type="text"
                placeholder="e.g. Paris, Tokyo, New York..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-10 pl-9 border-[var(--neutral-30)] text-sm placeholder:text-[var(--neutral-50)]"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex flex-1 gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor="event-start"
                className="text-xs font-medium text-[var(--neutral-60)]"
              >
                Start Date
              </label>
              <Input
                id="event-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 border-[var(--neutral-30)] text-sm"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor="event-end"
                className="text-xs font-medium text-[var(--neutral-60)]"
              >
                End Date
              </label>
              <Input
                id="event-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 border-[var(--neutral-30)] text-sm"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!city.trim() || isLoading}
            className="h-10 gap-2 rounded-lg bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)]"
          >
            <MagnifyingGlass size={16} weight="bold" />
            Search Events
          </Button>
        </motion.form>

        {/* Category Filter Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === cat.value
                  ? 'bg-[var(--primary-main)] text-white'
                  : 'border border-[var(--neutral-30)] bg-[var(--neutral-10)] text-[var(--neutral-70)] hover:bg-[var(--neutral-20)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </motion.div>

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              onClick={() => searchEvents(1, false)}
              variant="outline"
              className="rounded-lg"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <EventsSkeleton />
        ) : hasSearched && events.length === 0 && !error ? (
          <EmptyState city={city} />
        ) : events.length > 0 ? (
          <>
            {/* Results count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--neutral-60)]">
                Showing{' '}
                <span className="font-medium text-[var(--neutral-100)]">
                  {events.length}
                </span>{' '}
                of{' '}
                <span className="font-medium text-[var(--neutral-100)]">
                  {pagination?.total ?? 0}
                </span>{' '}
                events
              </p>
            </div>

            {/* Event Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {events.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={index}
                  onSelect={setSelectedEvent}
                />
              ))}
            </div>

            {/* Load More */}
            {pagination?.hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  variant="outline"
                  className="gap-2 rounded-lg px-8"
                >
                  {isLoadingMore
                    ? 'Loading...'
                    : 'Load More Events'}
                </Button>
              </div>
            )}
          </>
        ) : !hasSearched ? (
          <EmptyState city="" />
        ) : null}

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedEvent && (
            <EventDetailModal
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================
// Page
// ============================================

export default function EventsPage() {
  return <EventsContent />;
}
