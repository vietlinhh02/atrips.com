'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  SpinnerGap,
  CalendarBlank,
  UsersThree,
  CurrencyDollar,
  FloppyDisk,
  NavigationArrow,
  ShareNetwork,
} from '@phosphor-icons/react';
import shareService from '@/src/services/shareService';
import useAuthStore from '@/src/stores/authStore';
import { toast } from '@/src/components/ui/use-toast';
import type { TripWithItinerary } from '@/src/services/tripService';
import type { ItineraryStructuredData } from '@/src/types/itinerary.types';

const SharedTripMap = dynamic(() => import('./SharedTripMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-[var(--neutral-20)]">
      <SpinnerGap size={24} className="animate-spin text-[var(--neutral-60)]" />
    </div>
  ),
});

const TripItineraryTimelineCard = dynamic(
  () => import('@/src/components/features/chat/page/TripItineraryTimelineCard'),
  { ssr: false },
);

// ── Helpers ──

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  } catch { return iso; }
}

function fmtBudget(amount: number, currency = 'VND'): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(amount);
}

const DAY_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

// ── Main page ──

export default function SharedTripPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = typeof params.shareToken === 'string' ? params.shareToken : '';
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [trip, setTrip] = useState<TripWithItinerary | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryStructuredData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await shareService.getSharedTrip(shareToken);
        const tripData = data as TripWithItinerary;
        setTrip(tripData);

        // Build ItineraryStructuredData from trip's own fields
        // (overview, metadata.tips, metadata.budgetBreakdown)
        const raw = data as Record<string, unknown>;
        const overview = raw.overview as Record<string, unknown> | string | null;
        const metadata = raw.metadata as Record<string, unknown> | null;

        const overviewObj = overview && typeof overview === 'object' ? overview : null;
        const tips = metadata?.tips as ItineraryStructuredData['travelTips'] | undefined;
        const budgetBreakdown = metadata?.budgetBreakdown as ItineraryStructuredData['budgetBreakdown'] | undefined;

        // API may use "transport" instead of "transportation"
        const rawTips = metadata?.tips as Record<string, unknown> | undefined;
        const mappedTips: ItineraryStructuredData['travelTips'] = rawTips ? {
          general: rawTips.general as string[] | undefined,
          transportation: (rawTips.transportation ?? rawTips.transport) as string[] | undefined,
          food: rawTips.food as string[] | undefined,
          safety: rawTips.safety as string[] | undefined,
          budget: rawTips.budget as string[] | undefined,
        } : undefined;

        setItinerary({
          destination: tripData.description?.replace('Trip to ', '') || tripData.title,
          tripTitle: tripData.title,
          startDate: tripData.startDate,
          endDate: tripData.endDate,
          budget: tripData.budgetTotal ?? undefined,
          currency: tripData.budgetCurrency,
          travelers: tripData.travelersCount,
          overview: typeof overview === 'string'
            ? overview
            : (overviewObj?.summary as string) || undefined,
          overviewData: overviewObj as ItineraryStructuredData['overviewData'],
          travelTips: mappedTips,
          budgetBreakdown,
          days: [],
        } as ItineraryStructuredData);
      } catch {
        setError('This trip link is invalid or has expired.');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [shareToken]);

  const handleSave = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/trips/shared/${shareToken}`);
      return;
    }
    try {
      setIsSaving(true);
      await shareService.duplicateSharedTrip(shareToken);
      toast.success('Trip saved to your account!');
      router.push('/trips');
    } catch {
      setIsSaving(false);
      toast.error('Failed to save trip.');
    }
  };

  const markers = useMemo(() => {
    if (!trip) return [];
    let idx = 0;
    return [...trip.itinerary_days]
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .flatMap((day) =>
        day.activities
          .filter((a) => a.latitude && a.longitude)
          .map((a) => ({
            id: a.id,
            lat: a.latitude!,
            lng: a.longitude!,
            name: a.name,
            dayNumber: day.dayNumber,
            index: ++idx,
            color: DAY_COLORS[(day.dayNumber - 1) % DAY_COLORS.length],
          })),
      );
  }, [trip]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--neutral-10)]">
        <SpinnerGap size={28} className="animate-spin text-[var(--primary-main)]" />
      </div>
    );
  }

  // ── Error ──
  if (error && !trip) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--neutral-10)]">
        <div className="text-center space-y-3">
          <NavigationArrow size={40} className="mx-auto text-[var(--neutral-40)]" />
          <h1 className="text-lg font-semibold text-[var(--neutral-100)]">Trip not found</h1>
          <p className="text-sm text-[var(--neutral-60)]">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-2 px-4 py-2 bg-[var(--primary-main)] text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            Go to Atrips
          </button>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  const dateRange = trip.startDate && trip.endDate
    ? `${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}`
    : undefined;
  const budgetLabel = trip.budgetTotal
    ? fmtBudget(trip.budgetTotal, trip.budgetCurrency)
    : undefined;
  const travelersLabel = `${trip.travelersCount} Traveler${trip.travelersCount !== 1 ? 's' : ''}`;

  return (
    <>
      {/* ── Header bar (same height as ChatHeader: 52px) ── */}
      <div className="shrink-0 h-[52px] flex items-center justify-between gap-3 px-4 border-b border-[var(--neutral-30)] bg-white z-20">
        <div className="flex items-center gap-3 min-w-0">
          <ShareNetwork size={18} className="shrink-0 text-[var(--primary-main)]" />
          <h1 className="text-[14px] font-semibold text-[var(--neutral-100)] truncate">
            {trip.title}
          </h1>
          <span className="hidden sm:inline text-[11px] font-medium text-[var(--primary-main)] bg-[var(--primary-surface)] px-2 py-0.5 rounded-full shrink-0">
            Shared
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-3">
            {dateRange && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--neutral-60)]">
                <CalendarBlank size={12} /> {dateRange}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-[var(--neutral-60)]">
              <UsersThree size={12} /> {trip.travelersCount}
            </span>
            {budgetLabel && (
              <span className="flex items-center gap-1 text-[11px] text-[var(--neutral-60)]">
                <CurrencyDollar size={12} /> {budgetLabel}
              </span>
            )}
          </div>

          <button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-main)] text-white rounded-[8px] text-[12px] font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {isSaving ? <SpinnerGap size={13} className="animate-spin" /> : <FloppyDisk size={13} />}
            {isSaving ? 'Saving...' : 'Save to my trips'}
          </button>
        </div>
      </div>

      {/* ── Content: identical layout to chat page ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="relative h-full w-full overflow-hidden bg-[var(--neutral-10)]">
          {/* Map background (absolute, same as chat page) */}
          <div className="absolute inset-0">
            <SharedTripMap markers={markers} />
          </div>

          {/* Floating panel layer (same structure as chat page) */}
          <div className="relative flex h-full w-full items-start gap-2 p-0 md:p-6 pointer-events-none z-10">
            {/* Spacer to push itinerary to the right (like chat panel takes left) */}
            <div className="flex-1" />

            {/* Itinerary panel — reuses TripItineraryTimelineCard */}
            <div className="hidden xl:flex h-full w-full max-w-[444px] pointer-events-auto relative">
              <TripItineraryTimelineCard
                tripId={trip.id}
                savedTrip={trip}
                itinerary={itinerary}
                title={trip.title}
                locationLabel={itinerary?.destination}
                dateRangeLabel={dateRange}
                travelersLabel={travelersLabel}
                budgetLabel={budgetLabel}
                tripCurrency={trip.budgetCurrency}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
