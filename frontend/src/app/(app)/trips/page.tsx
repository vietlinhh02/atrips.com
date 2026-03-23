'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AirplaneTilt,
  CalendarBlank,
  MapPin,
  MagnifyingGlass,
  Plus,
  Wallet,
  Users,
  SuitcaseSimple,
  Archive,
  CheckCircle,
  NotePencil,
} from '@phosphor-icons/react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Input } from '@/src/components/ui/input';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import tripService from '@/src/services/tripService';
import type { Trip } from '@/src/services/tripService';
import useChatStore from '@/src/stores/chatStore';

type TripStatus = Trip['status'];
type StatusFilter = TripStatus | 'ALL';

interface StatusTab {
  label: string;
  value: StatusFilter;
  icon: typeof AirplaneTilt;
}

const STATUS_TABS: StatusTab[] = [
  { label: 'All', value: 'ALL', icon: SuitcaseSimple },
  { label: 'Active', value: 'ACTIVE', icon: AirplaneTilt },
  { label: 'Completed', value: 'COMPLETED', icon: CheckCircle },
  { label: 'Drafts', value: 'DRAFT', icon: NotePencil },
  { label: 'Archived', value: 'ARCHIVED', icon: Archive },
];

const STATUS_COLORS: Record<TripStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  DRAFT: 'bg-[var(--neutral-20)] text-[var(--neutral-60)]',
  ARCHIVED: 'bg-amber-100 text-amber-700',
};

const COVER_GRADIENTS = [
  'from-[#073e71] to-[#0a5a8a]',
  'from-[#1a4731] to-[#2d6b4e]',
  'from-[#4a1942] to-[#7b2d6e]',
  'from-[#6b3a2a] to-[#a85d3f]',
  'from-[#2a3a6b] to-[#4a5fa8]',
];

function getGradient(id: string): string {
  let hash = 0;
  for (const ch of id) {
    hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  }
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length];
}

function formatDateRange(start: string, end: string): string {
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();

  if (startYear !== endYear) {
    return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
  }
  if (startMonth !== endMonth) {
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
  }
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'd, yyyy')}`;
}

function getDuration(start: string, end: string): string {
  const days = differenceInDays(parseISO(end), parseISO(start)) + 1;
  if (days <= 0) return '1 day';
  return days === 1 ? '1 day' : `${days} days`;
}

function formatBudget(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

// -- Skeleton Card --

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] overflow-hidden animate-pulse">
      <div className="h-40 bg-[var(--neutral-30)]" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-[var(--neutral-30)] rounded w-3/4" />
        <div className="h-4 bg-[var(--neutral-20)] rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-4 bg-[var(--neutral-20)] rounded w-24" />
          <div className="h-4 bg-[var(--neutral-20)] rounded w-16" />
        </div>
        <div className="h-6 bg-[var(--neutral-20)] rounded w-20" />
      </div>
    </div>
  );
}

// -- Trip Card --

interface TripCardProps {
  trip: Trip;
  index: number;
  onNavigate: (tripId: string) => void;
}

function TripCard({ trip, index, onNavigate }: TripCardProps) {
  const hasCover = Boolean(trip.coverImageUrl);
  const gradient = getGradient(trip.id);

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => onNavigate(trip.id)}
      className="group text-left rounded-xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] overflow-hidden
        hover:shadow-lg hover:border-[var(--primary-outer-border)] transition-all duration-200 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]"
    >
      {/* Cover Image */}
      <div className="relative h-40 overflow-hidden">
        {hasCover ? (
          <Image
            src={trip.coverImageUrl!}
            alt={trip.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
          >
            <AirplaneTilt
              size={48}
              weight="thin"
              className="text-white/30"
            />
          </div>
        )}

        {/* Status Badge (overlay) */}
        <div className="absolute top-3 right-3">
          <Badge
            className={`${STATUS_COLORS[trip.status]} text-[11px] font-semibold px-2 py-0.5 shadow-sm`}
          >
            {trip.status}
          </Badge>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-2.5">
        <h3 className="text-[15px] font-semibold text-[var(--neutral-100)] line-clamp-1 group-hover:text-[var(--primary-main)] transition-colors">
          {trip.title}
        </h3>

        {trip.description && (
          <p className="text-xs text-[var(--neutral-60)] line-clamp-1">
            {trip.description}
          </p>
        )}

        {/* Date + Duration */}
        <div className="flex items-center gap-3 text-xs text-[var(--neutral-60)]">
          <span className="flex items-center gap-1">
            <CalendarBlank size={14} weight="regular" />
            {formatDateRange(trip.startDate, trip.endDate)}
          </span>
          <span className="text-[var(--neutral-30)]">|</span>
          <span>{getDuration(trip.startDate, trip.endDate)}</span>
        </div>

        {/* Bottom row: budget + travelers */}
        <div className="flex items-center justify-between pt-1">
          {trip.budgetTotal ? (
            <span className="flex items-center gap-1 text-xs font-medium text-[var(--neutral-80)]">
              <Wallet size={14} />
              {formatBudget(trip.budgetTotal, trip.budgetCurrency)}
            </span>
          ) : (
            <span />
          )}

          {trip.travelersCount > 1 && (
            <span className="flex items-center gap-1 text-xs text-[var(--neutral-60)]">
              <Users size={14} />
              {trip.travelersCount}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// -- Empty State --

function EmptyState({ onPlan }: { onPlan: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-[var(--primary-surface)] flex items-center justify-center mb-6">
        <AirplaneTilt size={36} weight="duotone" className="text-[var(--primary-main)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--neutral-100)] mb-2">
        No trips yet
      </h3>
      <p className="text-sm text-[var(--neutral-60)] max-w-xs mb-6">
        Start planning your next adventure with our AI travel assistant.
      </p>
      <Button
        onClick={onPlan}
        className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90 rounded-lg px-5 py-2.5 text-sm font-medium"
      >
        <Plus size={16} weight="bold" className="mr-1.5" />
        Start Planning
      </Button>
    </motion.div>
  );
}

// -- Error State --

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <p className="text-sm text-red-600 mb-4">{message}</p>
      <Button
        onClick={onRetry}
        variant="outline"
        className="text-sm"
      >
        Try Again
      </Button>
    </div>
  );
}

// -- Filtered-Empty State --

function FilteredEmptyState({ filter }: { filter: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <MapPin size={32} weight="duotone" className="text-[var(--neutral-40)] mb-3" />
      <p className="text-sm text-[var(--neutral-60)]">
        No {filter.toLowerCase()} trips found.
      </p>
    </motion.div>
  );
}

// -- Main Content --

function TripsContent() {
  const router = useRouter();
  const createConversation = useChatStore((s) => s.createConversation);
  const resetConversation = useChatStore((s) => s.resetConversation);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await tripService.listTrips({ limit: 100 });
      setTrips(result.trips);
      setTotalCount(result.pagination.total);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load trips';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ALL: trips.length,
      ACTIVE: 0,
      COMPLETED: 0,
      DRAFT: 0,
      ARCHIVED: 0,
    };
    for (const trip of trips) {
      counts[trip.status]++;
    }
    return counts;
  }, [trips]);

  const filteredTrips = useMemo(() => {
    let result = trips;

    if (activeFilter !== 'ALL') {
      result = result.filter((t) => t.status === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false)
      );
    }

    return result.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [trips, activeFilter, searchQuery]);

  const handlePlanNewTrip = useCallback(async () => {
    resetConversation();
    const conversationId = await createConversation();
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    } else {
      router.push('/');
    }
  }, [createConversation, resetConversation, router]);

  const handleTripNavigate = useCallback(
    async (tripId: string) => {
      resetConversation();
      const conversationId = await createConversation(tripId);
      if (conversationId) {
        router.push(`/chat/${conversationId}`);
      }
    },
    [createConversation, resetConversation, router]
  );

  return (
    <div className="w-full max-w-[1320px] mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--neutral-100)]">
            My Trips
          </h2>
          {!isLoading && (
            <p className="text-sm text-[var(--neutral-60)] mt-0.5">
              {totalCount} {totalCount === 1 ? 'trip' : 'trips'} total
            </p>
          )}
        </div>

        <Button
          onClick={handlePlanNewTrip}
          className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-main)]/90 rounded-lg px-4 py-2 text-sm font-medium
            shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] w-fit"
        >
          <Plus size={16} weight="bold" className="mr-1.5" />
          Plan New Trip
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-hide">
        {STATUS_TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          const count = statusCounts[tab.value];
          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium
                whitespace-nowrap transition-all duration-150
                ${
                  isActive
                    ? 'bg-[var(--primary-surface)] text-[var(--primary-main)] border border-[var(--primary-outer-border)]'
                    : 'text-[var(--neutral-60)] hover:text-[var(--neutral-80)] hover:bg-[var(--neutral-20)] border border-transparent'
                }`}
            >
              <tab.icon size={16} weight={isActive ? 'fill' : 'regular'} />
              {tab.label}
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold
                  ${isActive ? 'bg-[var(--primary-main)] text-white' : 'bg-[var(--neutral-20)] text-[var(--neutral-60)]'}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <MagnifyingGlass
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neutral-50)]"
        />
        <Input
          type="search"
          placeholder="Search trips by title or description..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 border-[var(--neutral-30)] text-sm"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTrips} />
      ) : trips.length === 0 ? (
        <EmptyState onPlan={handlePlanNewTrip} />
      ) : filteredTrips.length === 0 ? (
        <FilteredEmptyState
          filter={activeFilter === 'ALL' ? searchQuery : activeFilter}
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filteredTrips.map((trip, i) => (
              <TripCard
                key={trip.id}
                trip={trip}
                index={i}
                onNavigate={handleTripNavigate}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// -- Page Wrapper --

export default function TripsPage() {
  return (
    <>
      <div className="absolute inset-0 z-[-1] bg-gradient-to-b from-[var(--neutral-10)] via-[var(--primary-surface)]/60 to-[var(--neutral-10)] min-h-full" />
      <TripsContent />
    </>
  );
}
