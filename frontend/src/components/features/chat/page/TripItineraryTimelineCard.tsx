'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowUUpLeft,
  ArrowUUpRight,
  Bus,
  CalendarBlank,
  CaretDown,
  CaretUp,
  ClockCountdown,
  CurrencyDollar,
  Export,
  LinkSimple,
  MapPin,
  MapTrifold,
  PencilSimpleLine,
  MagnifyingGlass,
  PlayCircle,
  Plus,
  ShareNetwork,
  SpinnerGap,
  Trash,
  UsersThree,
  X,
  YoutubeLogo,
} from '@phosphor-icons/react';

import { cn } from '@/src/lib/utils';
import BudgetBreakdown from '@/src/components/features/chat/page/BudgetBreakdown';
import ShareTripModal from '@/src/components/features/chat/page/ShareTripModal';
import tripService, { type TripWithItinerary } from '@/src/services/tripService';
import type { ImageAsset } from '@/src/services/tripService';
import aiConversationService from '@/src/services/aiConversationService';
import { resolveActivityImage } from '@/src/lib/utils/resolveImage';
import type { ActivityData, DayWeather, ItineraryStructuredData, TransportFromPrevious, YouTubeVideo } from '@/src/types/itinerary.types';
import WeatherBadge, { isOutdoorType, resolveWeatherConfig } from '@/src/components/features/chat/page/WeatherBadge';
import ActivityEditor from '@/src/components/features/trip/ActivityEditor';
import AddActivityForm from '@/src/components/features/trip/AddActivityForm';
import { generateICS, downloadFile } from '@/src/lib/exportTrip';
import { toast } from '@/src/components/ui/use-toast';

// ============================================
// Types
// ============================================

export interface TripTimelineActivity {
  id: string;
  title: string;
  time: string;
  imageUrl: string;
}

export interface TripTimelineDay {
  id: string;
  title: string;
  dateLabel: string;
  activities: TripTimelineActivity[];
}

type LocalActivity = {
  id: string;
  dayId: string;
  title: string;
  time: string;
  imageUrl: string;
  startTime?: string | null;
  endTime?: string | null;
  // Rich fields from DB
  description?: string | null;
  notes?: string | null;
  estimatedCost?: number | string | null;
  currency?: string;
  customAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  transportFromPrevious?: TransportFromPrevious | null;
  bookingUrl?: string | null;
  type?: string;
  duration?: number | null;
  googleMapsInfo?: ActivityData['googleMapsInfo'];
  placeName?: string;
  placeId?: string | null;
  imageAsset?: ImageAsset | null;
};

type LocalDay = {
  id: string;
  title: string;
  dateLabel: string;
  weather?: DayWeather;
  activities: LocalActivity[];
};

type ItineraryRuntimeDay = ItineraryStructuredData['days'][number] & {
  totalDistance?: number | string;
  totalTravelTime?: number | string;
};

type RuntimeOverviewBlock = {
  summary?: string;
  weather?: {
    season?: string;
    avgTemp?: number | string;
    condition?: string;
  };
  highlights?: string[];
  culturalNotes?: string;
  bestTimeToVisit?: string;
};

type ItineraryRuntimeData = Omit<ItineraryStructuredData, 'days'> & {
  days: ItineraryRuntimeDay[];
  overview?: string | RuntimeOverviewBlock;
  summary?: {
    totalPlaces?: number;
    totalDistance?: number | string;
    avgPlacesPerDay?: number | string;
  };
  tips?: string[];
  trip?: {
    duration?: string;
  };
  packingList?: {
    essentials?: string[];
    accessories?: string[];
    clothing?: string[];
    optional?: string[];
  };
  userPreferences?: {
    dietaryRestrictions?: string[] | null;
    accessibilityNeeds?: string[] | null;
  };
};

interface TripItineraryTimelineCardProps {
  className?: string;
  title?: string;
  locationLabel?: string;
  dateRangeLabel?: string;
  travelersLabel?: string;
  budgetLabel?: string;
  intro?: string;
  tabs?: string[];
  days?: TripTimelineDay[];
  tripId?: string;
  savedTrip?: TripWithItinerary;
  itinerary?: ItineraryStructuredData | null;
  /** Fallback currency for activities that have wrong/missing currency */
  tripCurrency?: string;
}

// ============================================
// Demo data
// ============================================

const defaultDays: TripTimelineDay[] = [
  {
    id: 'day-1',
    title: 'Day 1 – Island Bliss in Bali',
    dateLabel: '18, July',
    activities: [
      {
        id: 'rice-terrace',
        title: 'Tegallalang Rice Terrace',
        time: 'All Day',
        imageUrl:
          'https://images.unsplash.com/photo-1531973576160-7125cd663d86?auto=format&fit=crop&w=400&q=80',
      },
      {
        id: 'seniman-coffee',
        title: 'Seniman Coffee',
        time: '08:00 – 12:00',
        imageUrl:
          'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
      },
    ],
  },
];

// ============================================
// Helpers
// ============================================

function formatDateShort(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCost(amount: number | string | null | undefined, currency?: string): string {
  if (!amount) return '';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0) return '';
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: currency || 'VND',
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `${num.toLocaleString()} ${currency || 'VND'}`;
  }
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getBudgetValue(
  value: number | { total?: number; perDay?: number } | undefined
): number | null {
  if (typeof value === 'number') return toPositiveNumber(value);
  if (value && typeof value === 'object') return toPositiveNumber(value.total);
  return null;
}

function flattenTravelTips(tips: ItineraryStructuredData['travelTips'] | undefined): string[] {
  if (!tips) return [];
  const groups = [tips.general, tips.transportation, tips.food, tips.safety, tips.budget];
  return groups
    .flatMap((group) => (Array.isArray(group) ? group : []))
    .filter((tip): tip is string => typeof tip === 'string' && tip.trim().length > 0);
}

function formatKm(value: number): string {
  return Number.isInteger(value) ? `${value} km` : `${value.toFixed(1)} km`;
}

function getOverviewImages(itinerary: ItineraryRuntimeData | null | undefined): string[] {
  if (!itinerary?.days?.length) return [];

  const images: string[] = [];
  for (const day of itinerary.days) {
    for (const activity of day.activities || []) {
      for (const image of getActivityImageCandidates(activity)) {
        if (!images.includes(image)) {
          images.push(image);
          if (images.length >= 3) return images;
        }
      }
    }
  }

  return images;
}

function getOverviewBlock(
  itinerary: ItineraryStructuredData | null | undefined,
  runtime: ItineraryRuntimeData | null | undefined
): RuntimeOverviewBlock | null {
  if (itinerary?.overviewData && typeof itinerary.overviewData === 'object') {
    return itinerary.overviewData as RuntimeOverviewBlock;
  }
  if (runtime?.overview && typeof runtime.overview === 'object') {
    return runtime.overview as RuntimeOverviewBlock;
  }
  return null;
}


function formatTime(isoOrTime: string | null | undefined): string {
  if (!isoOrTime) return '';
  if (isoOrTime.includes('T')) {
    // ISO datetime from @db.Time stored as 1970-01-01T09:00:00.000Z → extract HH:MM
    const date = new Date(isoOrTime);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    });
  }
  return isoOrTime;
}

function isHttpImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function isGeneratedPlaceholderImage(url: string): boolean {
  return /picsum\.photos/i.test(url);
}

function toUniqueUrls(values: unknown[]): string[] {
  return values.filter(isHttpImageUrl).filter((value, index, arr) => arr.indexOf(value) === index);
}

function getActivityImageCandidates(itineraryActivity?: ActivityData): string[] {
  if (!itineraryActivity) return [];

  const raw = itineraryActivity as unknown as Record<string, unknown>;
  const googleMapsInfo =
    itineraryActivity.googleMapsInfo && typeof itineraryActivity.googleMapsInfo === 'object'
      ? (itineraryActivity.googleMapsInfo as Record<string, unknown>)
      : null;

  const photosFromActivity = Array.isArray(raw.photos) ? raw.photos : [];
  const photosFromGoogleMaps = googleMapsInfo && Array.isArray(googleMapsInfo.photos)
    ? googleMapsInfo.photos
    : [];

  const primaryCandidates = toUniqueUrls([
    itineraryActivity.image,
    itineraryActivity.thumbnail,
    raw.imageUrl,
    raw.thumbnailUrl,
  ]);
  const photoCandidates = toUniqueUrls([
    ...photosFromActivity,
    ...photosFromGoogleMaps,
  ]);

  return [...primaryCandidates, ...photoCandidates];
}

function getFirstValidImage(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  const nonPlaceholder = candidates.find((url) => !isGeneratedPlaceholderImage(url));
  return nonPlaceholder || candidates[0];
}

function getActivityImage(type: string, itineraryActivity?: ActivityData): string {
  const fromItinerary = getFirstValidImage(getActivityImageCandidates(itineraryActivity));
  if (fromItinerary) return fromItinerary;
  const images: Record<string, string> = {
    ATTRACTION:
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=400&q=80',
    DINING:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=400&q=80',
    ACCOMMODATION:
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=400&q=80',
    TRANSPORTATION:
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=400&q=80',
    ACTIVITY:
      'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=400&q=80',
    SHOPPING:
      'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=400&q=80',
    OTHER:
      'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=400&q=80',
  };
  return images[type?.toUpperCase()] || images.OTHER;
}

function normalizeActivityName(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function tripToTimelineDays(
  trip: TripWithItinerary,
  itinerary: ItineraryStructuredData | null,
  tripCurrency?: string
): LocalDay[] {
  return trip.itinerary_days.map((day) => {
    const itineraryDay = itinerary?.days.find((d) => d.dayNumber === day.dayNumber);
    const itineraryDayActivities = itineraryDay?.activities || [];
    return {
      id: day.id,
      // notes holds the day theme/title (schema has no title field)
      title: day.notes || itineraryDay?.theme || itineraryDay?.title || `Ngày ${day.dayNumber}`,
      dateLabel: formatDateShort(day.date),
      weather: itineraryDay?.weather,
      activities: [...day.activities]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((activity, index) => {
          const normalizedName = normalizeActivityName(activity.name);
          const itineraryActivity = itineraryDayActivities.find((item, itemIndex) => {
            const itemName = normalizeActivityName(item.name || item.title);
            if (normalizedName && itemName === normalizedName) return true;
            return itemIndex === index;
          });
          const cdnImage = resolveActivityImage(activity, 'card');
          const imageUrl = cdnImage || getActivityImage(activity.type, itineraryActivity);
          const startFmt = formatTime(activity.startTime);
          const endFmt = formatTime(activity.endTime);
          const timeParts = [startFmt, endFmt].filter(Boolean);
          const itineraryTime = formatTime(itineraryActivity?.startTime || itineraryActivity?.time);
          const time =
            timeParts.length > 0
              ? timeParts.join(' – ')
              : itineraryTime || 'Cả ngày';

          // Use trip currency as fallback when activity has wrong default ("USD")
          const resolvedCurrency =
            activity.currency && activity.currency !== 'USD'
              ? activity.currency
              : (tripCurrency || activity.currency || 'VND');
          const itineraryCoordinates =
            itineraryActivity?.coordinates && typeof itineraryActivity.coordinates === 'object'
              ? itineraryActivity.coordinates
              : undefined;
          const itineraryLat =
            typeof itineraryCoordinates?.lat === 'number' ? itineraryCoordinates.lat : null;
          const itineraryLng =
            typeof itineraryCoordinates?.lng === 'number' ? itineraryCoordinates.lng : null;
          const itineraryAddress = [
            itineraryActivity?.location,
            itineraryActivity?.address,
            itineraryCoordinates?.placeName,
          ].find((value) => typeof value === 'string' && value.trim().length > 0) as
            | string
            | undefined;
          const mergedDescription =
            activity.description || itineraryActivity?.description || itineraryActivity?.details;
          const mergedNotes =
            activity.notes || itineraryActivity?.details || null;

          return {
            id: activity.id,
            title: itineraryActivity?.title || activity.name,
            time,
            imageUrl,
            dayId: day.id,
            startTime: activity.startTime,
            endTime: activity.endTime,
            description: mergedDescription,
            // Fall back to description as notes when notes is null
            notes: mergedNotes,
            estimatedCost: activity.estimatedCost,
            currency: resolvedCurrency,
            customAddress: activity.customAddress || itineraryAddress || null,
            latitude: activity.latitude ?? itineraryLat,
            longitude: activity.longitude ?? itineraryLng,
            transportFromPrevious:
              activity.transportFromPrevious || itineraryActivity?.transportFromPrevious || null,
            bookingUrl:
              activity.bookingUrl ||
              (
                (itineraryActivity as unknown as Record<string, unknown> | undefined)
                  ?.bookingUrl as string | undefined
              ) ||
              null,
            type: activity.type || itineraryActivity?.type,
            duration: activity.duration ?? itineraryActivity?.duration,
            googleMapsInfo: itineraryActivity?.googleMapsInfo,
            placeName: itineraryCoordinates?.placeName,
            placeId: activity.placeId || itineraryActivity?.placeId || null,
            imageAsset: activity.image_assets,
          };
        }),
    };
  });
}

function sourceDaysToLocalDays(sourceDays: TripTimelineDay[]): LocalDay[] {
  return sourceDays.map((d) => ({
    ...d,
    activities: d.activities.map((a) => ({ ...a, dayId: d.id })),
  }));
}

// ============================================
// Sub-components
// ============================================

function TransportBadge({ t }: { t: TransportFromPrevious }) {
  if (!t.mode) return null;
  const duration = typeof t.duration === 'number' ? `${t.duration} phút` : t.duration;
  const distance = typeof t.distance === 'number' ? `${t.distance} km` : t.distance;
  return (
    <div className="flex items-center gap-1.5 py-1.5 px-3 my-1 mx-auto text-[11px] text-[var(--neutral-60)] bg-[var(--neutral-20)] rounded-full w-fit">
      <Bus size={11} />
      <span>
        {t.mode}
        {duration ? ` · ${duration}` : ''}
        {distance ? ` · ${distance}` : ''}
      </span>
    </div>
  );
}

function ActivityDetailPanel({
  activity,
  onClose,
  onPreviewImage,
}: {
  activity: LocalActivity;
  onClose: () => void;
  onPreviewImage?: (src: string, alt: string) => void;
}) {
  const hasMaps =
    typeof activity.latitude === 'number' && typeof activity.longitude === 'number';
  const displayAddress = activity.customAddress || activity.placeName;
  // Build Google Maps URL that opens the actual place page, not just a coordinate pin.
  // Priority: place_id (exact match) > place name search > coordinate fallback
  const mapsSearchTerm = activity.title || activity.placeName || activity.customAddress;
  const mapsUrl = (() => {
    if (activity.placeId) {
      // query_place_id opens the exact place page on Google Maps
      const query = mapsSearchTerm || `${activity.latitude},${activity.longitude}`;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${activity.placeId}`;
    }
    if (mapsSearchTerm) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsSearchTerm)}`;
    }
    if (hasMaps) {
      return `https://www.google.com/maps/search/?api=1&query=${activity.latitude},${activity.longitude}`;
    }
    return null;
  })();
  const rating =
    typeof activity.googleMapsInfo?.rating === 'number'
      ? activity.googleMapsInfo.rating
      : null;
  const openingHours =
    typeof activity.googleMapsInfo?.openingHours === 'string'
      ? activity.googleMapsInfo.openingHours
      : null;

  const typeLabel: Record<string, string> = {
    ATTRACTION: 'Điểm tham quan',
    DINING: 'Ăn uống',
    ACCOMMODATION: 'Lưu trú',
    TRANSPORTATION: 'Di chuyển',
    ACTIVITY: 'Hoạt động',
    SHOPPING: 'Mua sắm',
    OTHER: 'Khác',
  };

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      className="flex flex-col"
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onClose}
        className="mb-4 flex items-center gap-1.5 text-[13px] text-[var(--neutral-60)] hover:text-[var(--neutral-100)] transition-colors self-start"
      >
        <ArrowLeft size={15} />
        <span>Quay lại lịch trình</span>
      </button>

      {/* Hero image */}
      <div className="relative w-full h-[220px] shrink-0 overflow-hidden rounded-[14px]">
        <img
          src={activity.imageUrl}
          alt={activity.title}
          className="w-full h-full object-cover cursor-zoom-in"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback =
              'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=600&q=80';
            if (target.src !== fallback) target.src = fallback;
          }}
          onClick={() => onPreviewImage?.(activity.imageUrl, activity.title)}
        />
        {activity.type && (
          <span className="absolute top-3 left-3 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full bg-black/50 text-white backdrop-blur-sm">
            {typeLabel[activity.type] || activity.type}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 pt-5">
        {/* Title + cost */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[22px] font-medium leading-[1.25] text-[var(--neutral-100)]">
            {activity.title}
          </h3>
          {activity.estimatedCost && (
            <span className="shrink-0 text-[14px] font-semibold text-[var(--primary-main)] bg-[var(--primary-surface)] px-3 py-1 rounded-full">
              {formatCost(activity.estimatedCost, activity.currency)}
            </span>
          )}
        </div>

        {/* Meta: time + duration */}
        {(activity.time || activity.duration) && (
          <div className="flex flex-wrap gap-3">
            {activity.time && activity.time !== 'Cả ngày' && (
              <div className="flex items-center gap-1.5 text-[13px] text-[var(--neutral-70)]">
                <ClockCountdown size={14} className="text-[var(--primary-main)]" />
                <span>{activity.time}</span>
              </div>
            )}
            {activity.duration && (
              <div className="flex items-center gap-1.5 text-[13px] text-[var(--neutral-70)]">
                <span className="w-1 h-1 rounded-full bg-[var(--neutral-40)]" />
                <span>{activity.duration} phút</span>
              </div>
            )}
          </div>
        )}

        {(rating || openingHours) && (
          <div className="flex flex-wrap gap-3 text-[13px] text-[var(--neutral-70)]">
            {rating && (
              <div className="flex items-center gap-1.5">
                <span className="text-[var(--primary-main)]">Rating:</span>
                <span>{rating.toFixed(1)}</span>
              </div>
            )}
            {openingHours && (
              <div className="flex items-center gap-1.5">
                <ClockCountdown size={14} className="text-[var(--primary-main)]" />
                <span>{openingHours}</span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {activity.description && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-50)]">
              Mô tả
            </p>
            <p className="text-[14px] leading-[1.65] text-[var(--neutral-80)]">
              {activity.description}
            </p>
          </div>
        )}

        {/* Notes / Tips */}
        {activity.notes && activity.notes !== activity.description && (
          <div className="rounded-[12px] bg-[var(--primary-surface)] border border-[var(--primary-lighter)] p-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--primary-main)]">
              Gợi ý
            </p>
            <p className="text-[13px] leading-[1.6] text-[var(--neutral-80)]">{activity.notes}</p>
          </div>
        )}

        {/* Address */}
        {displayAddress && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-50)]">
              Địa chỉ
            </p>
            <div className="flex items-start gap-2 text-[13px] text-[var(--neutral-70)]">
              <MapPin
                size={14}
                weight="fill"
                className="mt-0.5 shrink-0 text-[var(--primary-main)]"
              />
              <span>{displayAddress}</span>
            </div>
          </div>
        )}

        {/* Transport from previous */}
        {activity.transportFromPrevious?.mode && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-50)]">
              Di chuyển từ điểm trước
            </p>
            <div className="rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] p-3.5">
              <div className="flex items-center gap-2 text-[13px] text-[var(--neutral-80)]">
                <Bus size={14} className="shrink-0 text-[var(--primary-main)]" />
                <span className="font-medium">{activity.transportFromPrevious.mode}</span>
                {typeof activity.transportFromPrevious.duration === 'number' && (
                  <span className="text-[var(--neutral-60)]">
                    · {activity.transportFromPrevious.duration} phút
                  </span>
                )}
                {typeof activity.transportFromPrevious.distance === 'number' && (
                  <span className="text-[var(--neutral-60)]">
                    · {activity.transportFromPrevious.distance} km
                  </span>
                )}
              </div>
              {typeof activity.transportFromPrevious.cost === 'number' &&
                activity.transportFromPrevious.cost > 0 && (
                  <p className="mt-1.5 text-[12px] text-[var(--neutral-60)]">
                    Chi phí:{' '}
                    {formatCost(activity.transportFromPrevious.cost, activity.currency)}
                  </p>
                )}
              {activity.transportFromPrevious.instructions && (
                <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--neutral-60)]">
                  {activity.transportFromPrevious.instructions}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 pb-4">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-[var(--neutral-30)] py-2.5 text-[13px] font-medium text-[var(--neutral-80)] hover:bg-[var(--neutral-20)] transition-colors"
            >
              <MapPin size={15} weight="fill" className="text-[var(--primary-main)]" />
              Xem trên Maps
            </a>
          )}
          {activity.bookingUrl && (
            <a
              href={activity.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-[var(--primary-main)] py-2.5 text-[13px] font-medium text-white hover:bg-[var(--primary-main)]/90 transition-colors"
            >
              <LinkSimple size={15} />
              Đặt ngay
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function OverviewTabContent({
  itinerary,
  totalDays,
  intro,
  onPreviewImage,
}: {
  itinerary: ItineraryStructuredData | null | undefined;
  totalDays: number;
  intro: string;
  onPreviewImage?: (src: string, alt: string) => void;
}) {
  const runtime = itinerary as ItineraryRuntimeData | null | undefined;
  const summary = runtime?.summary;
  const overviewBlock = getOverviewBlock(itinerary, runtime);
  const overviewText =
    (typeof itinerary?.overview === 'string' ? itinerary.overview : undefined) ||
    overviewBlock?.summary ||
    itinerary?.description ||
    intro;
  const overviewImages = getOverviewImages(runtime);

  const totalPlacesFromSummary = toPositiveNumber(summary?.totalPlaces);
  const totalPlacesFromDays = itinerary?.days.reduce(
    (acc, day) => acc + (day.activities?.length || 0),
    0
  );
  const totalPlaces = totalPlacesFromSummary || totalPlacesFromDays || 0;

  const totalDistanceFromSummary = toPositiveNumber(summary?.totalDistance);
  const totalDistanceFromDays = runtime?.days.reduce((acc, day) => {
    const value = toPositiveNumber(day.totalDistance);
    return acc + (value || 0);
  }, 0) || 0;
  const totalDistanceFromTransport = runtime?.days.reduce((acc, day) => {
    const dayDistance = (day.activities || []).reduce((activityAcc, activity) => {
      const distance = toPositiveNumber(activity.transportFromPrevious?.distance);
      return activityAcc + (distance || 0);
    }, 0);
    return acc + dayDistance;
  }, 0) || 0;
  const totalDistance =
    totalDistanceFromSummary ||
    (totalDistanceFromDays > 0 ? totalDistanceFromDays : null) ||
    (totalDistanceFromTransport > 0 ? totalDistanceFromTransport : null);

  const avgPlacesPerDay =
    toPositiveNumber(summary?.avgPlacesPerDay) ||
    (totalPlaces > 0 && totalDays > 0 ? Number((totalPlaces / totalDays).toFixed(1)) : null);

  const totalBudget = getBudgetValue(itinerary?.budget);
  const perDayBudget = totalBudget && totalDays > 0 ? Math.round(totalBudget / totalDays) : null;

  const breakdown = itinerary?.budgetBreakdown;
  const budgetItems = [
    { label: 'Lưu trú', value: getBudgetValue(breakdown?.accommodation) },
    { label: 'Ăn uống', value: getBudgetValue(breakdown?.food) },
    { label: 'Di chuyển', value: getBudgetValue(breakdown?.transportation) },
    { label: 'Hoạt động', value: getBudgetValue(breakdown?.activities) },
    { label: 'Khác', value: getBudgetValue(breakdown?.miscellaneous) },
  ].filter((item) => item.value !== null);

  const tipsFromStructured = toStringArray(runtime?.tips);
  const tipsFromTravelTips = flattenTravelTips(itinerary?.travelTips);
  const tips = (tipsFromStructured.length > 0 ? tipsFromStructured : tipsFromTravelTips).slice(0, 6);

  const dietaryRestrictions = toStringArray(runtime?.userPreferences?.dietaryRestrictions);
  const accessibilityNeeds = toStringArray(runtime?.userPreferences?.accessibilityNeeds);
  const preferences = [...dietaryRestrictions, ...accessibilityNeeds].slice(0, 8);

  const packingItems = [
    ...toStringArray(runtime?.packingList?.essentials),
    ...toStringArray(runtime?.packingList?.accessories),
    ...toStringArray(runtime?.packingList?.clothing),
  ].slice(0, 8);

  const weather = overviewBlock?.weather;
  const highlights = toStringArray(overviewBlock?.highlights);
  const avgTempValue =
    typeof weather?.avgTemp === 'number' || typeof weather?.avgTemp === 'string'
      ? `${weather.avgTemp}°C`
      : null;
  const compactTips = tips.slice(0, 3);
  const compactPacking = packingItems.slice(0, 6);

  return (
    <div className="space-y-4">
      {overviewImages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-2">
          <div className="overflow-hidden rounded-[12px]">
            <img
              src={overviewImages[0]}
              alt="Trip overview"
              className="h-[172px] w-full object-cover cursor-zoom-in"
              onClick={() => onPreviewImage?.(overviewImages[0], 'Trip overview')}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="overflow-hidden rounded-[12px]">
              <img
                src={overviewImages[1] || overviewImages[0]}
                alt="Trip preview"
                className="h-[82px] w-full object-cover cursor-zoom-in"
                onClick={() => onPreviewImage?.(overviewImages[1] || overviewImages[0], 'Trip preview')}
              />
            </div>
            <div className="overflow-hidden rounded-[12px]">
              <img
                src={overviewImages[2] || overviewImages[0]}
                alt="Trip preview"
                className="h-[82px] w-full object-cover cursor-zoom-in"
                onClick={() => onPreviewImage?.(overviewImages[2] || overviewImages[0], 'Trip preview')}
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-70)]">
          Tổng quan
        </p>
        <p className="mt-2 text-[13px] leading-[1.55] text-[var(--neutral-100)]">{overviewText}</p>
        {(weather?.season || weather?.condition || avgTempValue || overviewBlock?.bestTimeToVisit) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {weather?.season && (
              <span className="rounded-full bg-[var(--neutral-30)] px-2.5 py-1 text-[11px] text-[var(--neutral-100)]">
                {weather.season}
              </span>
            )}
            {avgTempValue && (
              <span className="rounded-full bg-[var(--neutral-30)] px-2.5 py-1 text-[11px] text-[var(--neutral-100)]">
                {avgTempValue}
              </span>
            )}
            {weather?.condition && (
              <span className="rounded-full bg-[var(--neutral-30)] px-2.5 py-1 text-[11px] text-[var(--neutral-100)]">
                {weather.condition}
              </span>
            )}
            {overviewBlock?.bestTimeToVisit && (
              <span className="rounded-full bg-[var(--primary-surface)] px-2.5 py-1 text-[11px] text-[var(--primary-main)]">
                {overviewBlock.bestTimeToVisit}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <OverviewMetric label="Số ngày" value={`${totalDays}`} />
        <OverviewMetric label="Địa điểm" value={`${totalPlaces}`} />
        <OverviewMetric
          label="Tổng quãng đường"
          value={totalDistance ? formatKm(totalDistance) : '-'}
        />
        <OverviewMetric
          label="Điểm/ngày"
          value={avgPlacesPerDay ? `${avgPlacesPerDay}` : '-'}
        />
      </div>

      {(totalBudget || budgetItems.length > 0) && (
        <BudgetBreakdown
          totalBudget={totalBudget ?? 0}
          currency={itinerary?.currency ?? 'VND'}
          categories={budgetItems.map((item) => ({
            name: item.label,
            amount: item.value ?? 0,
          }))}
          dailySpend={itinerary?.days
            ?.filter((day) => day.dailyCost && day.dailyCost > 0)
            .map((day) => ({
              day: day.dayNumber ?? day.day ?? 1,
              amount: day.dailyCost ?? 0,
            }))}
        />
      )}

      {(highlights.length > 0 || overviewBlock?.culturalNotes || preferences.length > 0 || compactTips.length > 0 || compactPacking.length > 0) && (
        <div className="rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] p-3.5 space-y-3">
          {highlights.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-70)]">
                Điểm nổi bật
              </p>
              <div className="mt-2 space-y-1">
                {highlights.slice(0, 4).map((item, index) => (
                  <p key={`${item}-${index}`} className="text-[12px] leading-[1.5] text-[var(--neutral-100)]">
                    {index + 1}. {item}
                  </p>
                ))}
              </div>
            </div>
          )}

          {overviewBlock?.culturalNotes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-70)]">
                Lưu ý văn hóa
              </p>
              <p className="mt-1.5 text-[12px] leading-[1.5] text-[var(--neutral-100)]">
                {overviewBlock.culturalNotes}
              </p>
            </div>
          )}

          {preferences.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-70)]">
                Ưu tiên
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {preferences.slice(0, 6).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-[var(--primary-surface)] px-2.5 py-1 text-[11px] text-[var(--primary-main)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {compactTips.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-70)]">
                Tips nhanh
              </p>
              <div className="mt-1.5 space-y-1">
                {compactTips.map((tip, index) => (
                  <p key={`${tip}-${index}`} className="text-[12px] leading-[1.5] text-[var(--neutral-100)]">
                    {index + 1}. {tip}
                  </p>
                ))}
              </div>
            </div>
          )}

          {compactPacking.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--neutral-70)]">
                Chuẩn bị nhanh
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {compactPacking.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-[var(--neutral-30)] px-2.5 py-1 text-[11px] text-[var(--neutral-100)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatViewCount(views: number | undefined): string {
  if (!views) return '';
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K views`;
  return `${views} views`;
}

// Module-level cache so switching tabs / re-renders don't re-fetch
const videoSearchCache = new Map<string, YouTubeVideo[]>();

function VideosTabContent({
  itinerary,
  title,
  locationLabel,
}: {
  itinerary: ItineraryStructuredData | null | undefined;
  title: string;
  locationLabel?: string;
}) {
  const destination =
    itinerary?.destination || locationLabel || title || 'travel destination';

  const defaultQuery = `${destination} du lịch review`;
  const [searchQuery, setSearchQuery] = useState(defaultQuery);
  const [results, setResults] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const prevDestinationRef = useRef(destination);

  // Reset when destination changes (new conversation / different trip)
  useEffect(() => {
    if (prevDestinationRef.current !== destination) {
      prevDestinationRef.current = destination;
      const newQuery = `${destination} du lịch review`;
      setSearchQuery(newQuery);
      setResults([]);
      setHasSearched(false);
      setError(null);
      didAutoSearch.current = false; // allow auto-search again
    }
  }, [destination]);

  const handleSearch = useCallback(async (query?: string) => {
    const q = (query ?? searchQuery).trim();
    if (!q) return;

    // Return cached results if available
    const cached = videoSearchCache.get(q);
    if (cached) {
      setResults(cached);
      setHasSearched(true);
      return;
    }

    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const response = await aiConversationService.searchYouTubeVideos({
        query: q,
        maxResults: 12,
      });
      const videos = response.videos || [];
      videoSearchCache.set(q, videos);
      setResults(videos);
    } catch {
      setError('Không thể tìm kiếm video. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Auto-search on mount or after destination reset
  const didAutoSearch = useRef(false);
  useEffect(() => {
    if (!didAutoSearch.current) {
      didAutoSearch.current = true;
      handleSearch();
    }
  }, [handleSearch]);

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Tìm video YouTube..."
          className="flex-1 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] px-3 py-2 text-[13px] text-[var(--neutral-90)] placeholder:text-[var(--neutral-50)] outline-none focus:border-[var(--primary-main)]"
        />
        <button
          type="button"
          onClick={() => handleSearch()}
          disabled={loading || !searchQuery.trim()}
          className="flex items-center gap-1.5 rounded-[10px] bg-[var(--primary-main)] px-3 py-2 text-[13px] font-medium text-white hover:bg-[var(--primary-main)]/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <SpinnerGap size={16} className="animate-spin" />
          ) : (
            <MagnifyingGlass size={16} />
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-[12px] text-red-500">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <SpinnerGap size={24} className="animate-spin text-[var(--primary-main)]" />
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <p className="text-center text-[13px] text-[var(--neutral-50)] py-6">
          Không tìm thấy video nào.
        </p>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {results.map((video) => (
            <a
              key={video.videoId}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative rounded-[10px] border border-[var(--neutral-30)] overflow-hidden group hover:border-[var(--neutral-50)] transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-[var(--neutral-30)]">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                {video.duration && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] text-white">
                    {video.duration}
                  </span>
                )}
                {/* Play overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <PlayCircle size={32} weight="fill" className="text-white" />
                </div>
              </div>

              {/* Info */}
              <div className="p-2">
                <p className="text-[12px] font-medium text-[var(--neutral-90)] line-clamp-2 leading-tight">
                  {video.title}
                </p>
                <p className="mt-1 text-[11px] text-[var(--neutral-50)] truncate">
                  {video.channelTitle}
                </p>
                {video.views !== undefined && (
                  <p className="text-[10px] text-[var(--neutral-50)]">
                    {formatViewCount(video.views)}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function ImagePreviewModal({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm p-4 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        aria-label="Close image preview"
      >
        <X size={18} />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[92vw] rounded-[12px] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-20)] px-2.5 py-2">
      <p className="text-[10px] text-[var(--neutral-50)]">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-[var(--neutral-100)]">{value}</p>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function TripItineraryTimelineCard({
  className,
  title = 'Unlimited Bali Road Trip Guide',
  locationLabel = 'indonesia',
  dateRangeLabel = 'July 18 - 19',
  travelersLabel = '4 Travels',
  budgetLabel = '2.200',
  intro = 'Explore Your Journey',
  tabs = ['Overview', 'Itinerary', 'Videos'],
  days,
  tripId,
  savedTrip,
  itinerary,
  tripCurrency,
}: TripItineraryTimelineCardProps) {
  const isRealDataMode = !!savedTrip;

  const mappedDays = useMemo<LocalDay[]>(() => {
    if (savedTrip) {
      return tripToTimelineDays(
        savedTrip,
        itinerary ?? null,
        tripCurrency ?? savedTrip.budgetCurrency
      );
    }
    return sourceDaysToLocalDays(days ?? defaultDays);
  }, [savedTrip, itinerary, tripCurrency, days]);

  const [localDays, setLocalDays] = useState<LocalDay[]>(mappedDays);

  const [activeTab, setActiveTab] = useState(tabs[0] ?? 'Overview');
  const [openDayIds, setOpenDayIds] = useState<Set<string>>(
    () =>
      new Set(
        mappedDays[0]?.id ? [mappedDays[0].id] : []
      )
  );
  const [selectedActivity, setSelectedActivity] = useState<LocalActivity | null>(null);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);

  const [editingActivity, setEditingActivity] = useState<{
    id: string;
    dayId: string;
    field: 'title' | 'time';
  } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [expandedEditId, setExpandedEditId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [addingToDayId, setAddingToDayId] = useState<string | null>(null);

  const localDaysRef = useRef(localDays);
  useEffect(() => {
    localDaysRef.current = localDays;
  }, [localDays]);

  useEffect(() => {
    setLocalDays(mappedDays);
  }, [mappedDays]);

  useEffect(() => {
    setOpenDayIds((prev) => {
      if (localDays.length === 0) return new Set<string>();
      const validIds = new Set(localDays.map((day) => day.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      if (next.size === 0 && localDays[0]?.id) {
        next.add(localDays[0].id);
      }
      return next;
    });
  }, [localDays]);

  useEffect(() => {
    if (!selectedActivity) return;
    const updated = localDays
      .flatMap((day) => day.activities)
      .find((activity) => activity.id === selectedActivity.id);
    if (updated && updated !== selectedActivity) {
      setSelectedActivity(updated);
    }
  }, [localDays, selectedActivity]);

  useEffect(() => {
    if (activeTab.toLowerCase() !== 'itinerary') {
      setSelectedActivity(null);
    }
  }, [activeTab]);

  const totalDays = localDays.length;
  const isOverviewTab = activeTab.toLowerCase() === 'overview';
  const isVideosTab = activeTab.toLowerCase() === 'videos';

  // ============================================
  // Handlers
  // ============================================

  const handleReorder = useCallback(
    (dayId: string, newActivities: LocalActivity[]) => {
      setLocalDays((prev) =>
        prev.map((d) => (d.id === dayId ? { ...d, activities: newActivities } : d))
      );
    },
    []
  );

  const handleReorderEnd = useCallback(
    (dayId: string) => {
      if (!tripId) return;
      const day = localDaysRef.current.find((d) => d.id === dayId);
      if (!day) return;
      tripService
        .reorderActivities(tripId, dayId, day.activities.map((a) => a.id))
        .catch(() => {});
    },
    [tripId]
  );

  const handleActivityAdded = useCallback(
    (dayId: string, activity: LocalActivity) => {
      setLocalDays((prev) =>
        prev.map((d) =>
          d.id === dayId ? { ...d, activities: [...d.activities, activity] } : d
        )
      );
      setAddingToDayId(null);
    },
    []
  );

  const handleStartEdit = useCallback(
    (activityId: string, dayId: string, field: 'title' | 'time', currentValue: string) => {
      setEditingActivity({ id: activityId, dayId, field });
      setEditingValue(currentValue);
    },
    []
  );

  const handleSaveEdit = useCallback(async () => {
    if (!editingActivity) return;
    const { id: activityId, dayId, field } = editingActivity;
    const trimmed = editingValue.trim();
    setEditingActivity(null);
    if (!trimmed) return;

    setLocalDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        return {
          ...d,
          activities: d.activities.map((a) => {
            if (a.id !== activityId) return a;
            return field === 'title' ? { ...a, title: trimmed } : { ...a, time: trimmed };
          }),
        };
      })
    );

    if (!tripId) return;
    try {
      if (field === 'title') {
        await tripService.updateActivity(tripId, activityId, { name: trimmed });
      }
    } catch {
      // keep optimistic
    }
  }, [editingActivity, editingValue, tripId]);

  const handleCancelEdit = useCallback(() => setEditingActivity(null), []);

  const handleDelete = useCallback(
    async (activityId: string, dayId: string) => {
      setDeletingActivityId(null);
      setLocalDays((prev) =>
        prev.map((d) => {
          if (d.id !== dayId) return d;
          return { ...d, activities: d.activities.filter((a) => a.id !== activityId) };
        })
      );
      if (!tripId) return;
      try {
        await tripService.deleteActivity(tripId, activityId);
      } catch {}
    },
    [tripId]
  );

  // ============================================
  // Render
  // ============================================

  return (
    <section
      className={cn(
        'flex h-full w-full max-w-[444px] flex-col overflow-hidden rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-[6px_6px_32px_rgba(0,0,0,0.06)]',
        className
      )}
    >
      {/* ── Fixed Header ── */}
      <div className="shrink-0 px-4 md:px-5 pt-4 md:pt-5 pb-0 space-y-2">
        <h2 className="text-[18px] font-medium leading-[1.2] text-[var(--neutral-100)] line-clamp-2">{title}</h2>

        <div className="flex flex-wrap items-center gap-1.5">
          {locationLabel && <Badge icon={<MapPin size={14} />} label={locationLabel} />}
          {dateRangeLabel && <Badge icon={<CalendarBlank size={14} />} label={dateRangeLabel} />}
          {travelersLabel && <Badge icon={<UsersThree size={14} />} label={travelersLabel} />}
          {budgetLabel && <Badge icon={<CurrencyDollar size={14} />} label={budgetLabel} />}
        </div>

        <div className="flex items-end justify-between border-b border-[var(--neutral-30)] pt-1">
          <div className="flex items-center gap-1 overflow-x-auto pr-1">
            {tabs.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'rounded-t-[4px] px-3 py-1.5 text-[14px] leading-[1.5] transition-colors',
                    isActive
                      ? 'border-b border-[var(--neutral-100)] text-[var(--neutral-100)]'
                      : 'text-[var(--neutral-60)] hover:text-[var(--neutral-100)]'
                  )}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div className="mb-1.5 hidden sm:flex items-center gap-2 text-[var(--neutral-60)]">
            <button type="button" className="rounded p-1 hover:bg-[var(--neutral-20)]">
              <ArrowUUpLeft size={18} />
            </button>
            <button type="button" className="rounded p-1 hover:bg-[var(--neutral-20)]">
              <ArrowUUpRight size={18} />
            </button>
            <button type="button" className="rounded p-1 hover:bg-[var(--neutral-20)]">
              <MapTrifold size={18} />
            </button>
            {isRealDataMode && tripId && (
              <>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="rounded p-1 hover:bg-[var(--neutral-20)]"
                  aria-label="Share trip"
                >
                  <ShareNetwork size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!savedTrip) return;
                    const ics = generateICS(savedTrip);
                    const slug = savedTrip.title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)/g, '');
                    downloadFile(
                      ics,
                      `${slug || 'trip'}.ics`,
                      'text/calendar;charset=utf-8'
                    );
                    toast.success('Calendar exported!');
                  }}
                  className="rounded p-1 hover:bg-[var(--neutral-20)]"
                  aria-label="Export to calendar"
                >
                  <Export size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Scrollable Content ── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 scrollbar-thin">
        <AnimatePresence mode="wait">
          {isOverviewTab ? (
            <motion.div
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <OverviewTabContent
                itinerary={itinerary}
                totalDays={totalDays}
                intro={intro}
                onPreviewImage={(src, alt) => setPreviewImage({ src, alt })}
              />
            </motion.div>
          ) : isVideosTab ? (
            <motion.div
              key="videos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <VideosTabContent itinerary={itinerary} title={title} locationLabel={locationLabel} />
            </motion.div>
          ) : selectedActivity ? (
            /* ── Activity Detail Panel ── */
            <ActivityDetailPanel
              key="detail"
              activity={selectedActivity}
              onClose={() => setSelectedActivity(null)}
              onPreviewImage={(src, alt) => setPreviewImage({ src, alt })}
            />
          ) : (
            /* ── Day List ── */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="mb-5 flex items-center gap-2">
                <p className="text-[16px] font-medium text-[var(--neutral-100)]">Lịch trình</p>
                <span className="text-[12px] text-[var(--neutral-60)]">{totalDays} ngày</span>
              </div>
              <p className="mb-5 text-[14px] text-[var(--neutral-70)]">{intro}</p>

              <div className="space-y-5">
                {localDays.map((day) => {
                  const isOpen = openDayIds.has(day.id);
                  return (
                    <article key={day.id} className="space-y-3">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenDayIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(day.id)) {
                              next.delete(day.id);
                            } else {
                              next.add(day.id);
                            }
                            return next;
                          })
                        }
                        className="flex w-full items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-[16px] font-medium leading-[1.5] text-[var(--neutral-100)]">
                            {day.title}
                          </p>
                          <span className="text-[12px] text-[var(--neutral-60)]">
                            {day.dateLabel}
                          </span>
                          {day.weather && (
                            <WeatherBadge
                              condition={day.weather.condition}
                              tempHigh={day.weather.tempHigh}
                              tempLow={day.weather.tempLow}
                            />
                          )}
                        </div>
                        {isOpen ? (
                          <CaretUp size={18} className="text-[var(--neutral-80)]" />
                        ) : (
                          <CaretDown size={18} className="text-[var(--neutral-80)]" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="overflow-hidden rounded-[12px] border border-[var(--neutral-30)]">
                          <Reorder.Group
                            axis="y"
                            values={day.activities}
                            onReorder={(newActivities) =>
                              handleReorder(day.id, newActivities as LocalActivity[])
                            }
                            className="divide-y divide-[var(--neutral-30)]"
                          >
                            {day.activities.map((activity, actIdx) => {
                              const isEditing =
                                editingActivity?.id === activity.id &&
                                editingActivity.dayId === day.id;
                              const isDeleting = deletingActivityId === activity.id;
                              const isExpandedEdit = expandedEditId === activity.id;

                              return (
                                <Reorder.Item
                                  key={activity.id}
                                  value={activity}
                                  onDragEnd={() => handleReorderEnd(day.id)}
                                >
                                  {/* Transport badge */}
                                  {actIdx > 0 && activity.transportFromPrevious?.mode && (
                                    <div className="bg-[var(--neutral-20)] py-2">
                                      <TransportBadge t={activity.transportFromPrevious} />
                                    </div>
                                  )}

                                  {/* Activity card */}
                                  <div
                                    className={cn(
                                      'bg-[var(--neutral-10)] px-4 py-3 cursor-pointer group transition-colors hover:bg-[var(--neutral-20)]',
                                      isEditing && 'cursor-default hover:bg-[var(--neutral-10)]'
                                    )}
                                    onClick={() =>
                                      !isEditing && setSelectedActivity(activity)
                                    }
                                  >
                                    <div className="flex items-start gap-3">
                                      {/* Thumbnail */}
                                      <img
                                        src={activity.imageUrl}
                                        alt={activity.title}
                                        className="h-[60px] w-[60px] shrink-0 rounded-[8px] object-cover cursor-grab active:cursor-grabbing"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          const fallback =
                                            'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=400&q=80';
                                          if (target.src !== fallback) target.src = fallback;
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPreviewImage({
                                            src: activity.imageUrl,
                                            alt: activity.title,
                                          });
                                        }}
                                      />

                                      {/* Content */}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                          {/* Title */}
                                          {isEditing && editingActivity.field === 'title' ? (
                                            <input
                                              autoFocus
                                              value={editingValue}
                                              onChange={(e) => setEditingValue(e.target.value)}
                                              onBlur={handleSaveEdit}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEdit();
                                                if (e.key === 'Escape') handleCancelEdit();
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-full border-b border-[var(--primary-main)] bg-transparent text-[15px] font-medium text-[var(--neutral-100)] outline-none"
                                            />
                                          ) : (
                                            <p className="text-[13px] font-medium leading-[1.4] text-[var(--neutral-100)] group-hover:text-[var(--primary-main)] transition-colors line-clamp-1">
                                              {activity.title}
                                            </p>
                                          )}

                                          {/* Cost badge */}
                                          {activity.estimatedCost && (
                                            <span className="shrink-0 text-[11px] font-medium text-[var(--primary-main)] bg-[var(--primary-surface)] px-2 py-0.5 rounded-full whitespace-nowrap">
                                              {formatCost(
                                                activity.estimatedCost,
                                                activity.currency
                                              )}
                                            </span>
                                          )}
                                        </div>

                                        {/* Time */}
                                        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[var(--neutral-60)]">
                                          <ClockCountdown size={12} />
                                          {isEditing && editingActivity.field === 'time' ? (
                                            <input
                                              autoFocus
                                              value={editingValue}
                                              onChange={(e) => setEditingValue(e.target.value)}
                                              onBlur={handleSaveEdit}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveEdit();
                                                if (e.key === 'Escape') handleCancelEdit();
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="border-b border-[var(--primary-main)] bg-transparent text-[12px] outline-none"
                                            />
                                          ) : (
                                            <span>{activity.time}</span>
                                          )}
                                          {activity.duration && (
                                            <span className="text-[var(--neutral-50)]">
                                              · {activity.duration} phút
                                            </span>
                                          )}
                                        </div>

                                        {/* Rain warning for outdoor activities */}
                                        {day.weather &&
                                          resolveWeatherConfig(day.weather.condition).isRainy &&
                                          isOutdoorType(activity.type) && (
                                          <WeatherBadge
                                            condition={day.weather.condition}
                                            tempHigh={day.weather.tempHigh}
                                            tempLow={day.weather.tempLow}
                                            isOutdoorActivity
                                            className="mt-1 w-fit"
                                          />
                                        )}

                                        {/* Description preview */}
                                        {activity.description && (
                                          <p className="mt-1 text-[11px] leading-[1.5] text-[var(--neutral-70)] line-clamp-2">
                                            {activity.description}
                                          </p>
                                        )}

                                        {/* Address (display only) */}
                                        {activity.customAddress && (
                                          <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--neutral-50)]">
                                            <MapPin
                                              size={10}
                                              weight="fill"
                                              className="shrink-0 text-[var(--primary-main)]"
                                            />
                                            <span className="truncate">
                                              {activity.customAddress}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Edit/Delete buttons */}
                                      {isRealDataMode && (
                                        <div
                                          className="flex shrink-0 flex-col gap-1"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {isDeleting ? (
                                            <div className="flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleDelete(activity.id, day.id)
                                                }
                                                className="rounded-[6px] bg-red-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                                              >
                                                Xóa
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setDeletingActivityId(null)}
                                                className="rounded-[6px] border border-[var(--neutral-30)] px-2 py-1 text-[11px] text-[var(--neutral-70)] hover:bg-[var(--neutral-20)]"
                                              >
                                                Hủy
                                              </button>
                                            </div>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setExpandedEditId(activity.id)
                                                }
                                                className="rounded-[6px] p-1.5 text-[var(--neutral-50)] hover:bg-[var(--neutral-20)] hover:text-[var(--neutral-80)]"
                                                aria-label="Sửa hoạt động"
                                              >
                                                <PencilSimpleLine size={14} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setDeletingActivityId(activity.id)
                                                }
                                                className="rounded-[6px] p-1.5 text-[var(--neutral-50)] hover:bg-red-50 hover:text-red-500"
                                                aria-label="Xóa hoạt động"
                                              >
                                                <Trash size={14} />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Inline full-form editor */}
                                  {isExpandedEdit && tripId && (
                                    <div className="px-4 pb-3">
                                      <ActivityEditor
                                        tripId={tripId}
                                        activityId={activity.id}
                                        initial={{
                                          name: activity.title,
                                          description: activity.description ?? undefined,
                                          startTime: activity.startTime ?? undefined,
                                          endTime: activity.endTime ?? undefined,
                                          estimatedCost: activity.estimatedCost
                                            ? Number(activity.estimatedCost)
                                            : undefined,
                                          currency: activity.currency,
                                          notes: activity.notes ?? undefined,
                                        }}
                                        onSave={(updated) => {
                                          setExpandedEditId(null);
                                          setLocalDays((prev) =>
                                            prev.map((d) => {
                                              if (d.id !== day.id) return d;
                                              return {
                                                ...d,
                                                activities: d.activities.map((a) => {
                                                  if (a.id !== activity.id) return a;
                                                  return {
                                                    ...a,
                                                    title: updated.name,
                                                    description: updated.description ?? a.description,
                                                    startTime: updated.startTime ?? a.startTime,
                                                    endTime: updated.endTime ?? a.endTime,
                                                    estimatedCost:
                                                      updated.estimatedCost ?? a.estimatedCost,
                                                    notes: updated.notes ?? a.notes,
                                                  };
                                                }),
                                              };
                                            })
                                          );
                                        }}
                                        onCancel={() => setExpandedEditId(null)}
                                      />
                                    </div>
                                  )}
                                </Reorder.Item>
                              );
                            })}
                          </Reorder.Group>

                          {day.activities.length === 0 && (
                            <p className="py-4 text-center text-[14px] text-[var(--neutral-60)]">
                              Chưa có hoạt động nào
                            </p>
                          )}

                          {isRealDataMode && tripId && (() => {
                            const firstCoord = localDays
                              .flatMap((d) => d.activities)
                              .find((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number');
                            return (
                            <div className="p-3">
                              {addingToDayId === day.id ? (
                                <AddActivityForm
                                  tripId={tripId}
                                  dayId={day.id}
                                  cityLat={firstCoord?.latitude ?? undefined}
                                  cityLng={firstCoord?.longitude ?? undefined}
                                  onAdd={(activity) =>
                                    handleActivityAdded(day.id, activity as LocalActivity)
                                  }
                                  onCancel={() => setAddingToDayId(null)}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setAddingToDayId(day.id)}
                                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--neutral-40)] py-2 text-xs text-[var(--neutral-60)] hover:border-[var(--primary-main)] hover:text-[var(--primary-main)] transition-colors"
                                >
                                  <Plus size={14} />
                                  Add activity
                                </button>
                              )}
                            </div>
                            );
                          })()}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {localDays.length === 0 && (
                <p className="mt-8 text-center text-[14px] text-[var(--neutral-60)]">
                  Chưa có lịch trình.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal
            src={previewImage.src}
            alt={previewImage.alt}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </AnimatePresence>

      {tripId && savedTrip && (
        <ShareTripModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          tripId={tripId}
          tripTitle={title}
          currentVisibility={savedTrip.visibility}
        />
      )}
    </section>
  );
}

function Badge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--neutral-30)] px-2 py-1 text-[12px] text-[var(--neutral-60)]">
      {icon}
      {label}
    </span>
  );
}
