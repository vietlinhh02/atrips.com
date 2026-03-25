'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DotsThreeVertical,
  NumberCircleOne,
  NumberCircleTwo,
  NumberCircleThree,
  NumberCircleFour,
  NumberCircleFive,
  NumberCircleSix,
  NumberCircleSeven,
  NumberCircleEight,
  PencilSimpleLine,
  Sparkle,
  Trash,
  MapPin,
  CircleNotch,
  CaretDown,
  Star,
  Bus,
  X,
} from '@phosphor-icons/react';

import { cn } from '@/src/lib/utils';
import BudgetBreakdown from '@/src/components/features/chat/page/BudgetBreakdown';
import FileDropZone from '@/src/components/features/chat/page/FileDropZone';
import ConversationFileList from '@/src/components/features/chat/page/ConversationFileList';
import useChatStore from '@/src/stores/chatStore';
import type {
  ItineraryDayData,
  ActivityData,
  BudgetBreakdown as BudgetBreakdownType,
  BudgetCategoryDetail,
} from '@/src/types/itinerary.types';
import WeatherBadge from '@/src/components/features/chat/page/WeatherBadge';

interface TripPlanningSideCardProps {
  className?: string;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getActivityImage(activity: ActivityData): string | null {
  const raw = activity as unknown as Record<string, unknown>;
  const photos = Array.isArray(raw.photos) ? raw.photos : [];
  const googleMapsInfo =
    activity.googleMapsInfo && typeof activity.googleMapsInfo === 'object'
      ? (activity.googleMapsInfo as unknown as Record<string, unknown>)
      : null;
  const googlePhotos = googleMapsInfo && Array.isArray(googleMapsInfo.photos)
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
  const firstValid = candidates.find((value) => typeof value === 'string' && value.startsWith('http'));
  if (typeof firstValid === 'string') return firstValid;

  return null;
}

const formatCurrency = (amount?: number, currency = 'VND') => {
  if (amount === undefined || amount === null) return '';
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency', currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
};

function extractBudgetValue(
  value: BudgetCategoryDetail | number | undefined
): number | null {
  if (typeof value === 'number' && value > 0) return value;
  if (typeof value === 'object' && value?.total && value.total > 0) {
    return value.total;
  }
  return null;
}

function buildBudgetCategories(
  breakdown: BudgetBreakdownType | undefined
): { name: string; amount: number }[] {
  if (!breakdown) return [];
  const mapping: { key: keyof BudgetBreakdownType; label: string }[] = [
    { key: 'accommodation', label: 'Accommodation' },
    { key: 'food', label: 'Food & Dining' },
    { key: 'transportation', label: 'Transportation' },
    { key: 'activities', label: 'Activities' },
    { key: 'miscellaneous', label: 'Other' },
  ];
  return mapping
    .map(({ key, label }) => ({
      name: label,
      amount: extractBudgetValue(breakdown[key]) ?? 0,
    }))
    .filter((item) => item.amount > 0);
}

function DayNumberIcon({ dayNumber }: { dayNumber: number }) {
  const icons = [
    NumberCircleOne,
    NumberCircleTwo,
    NumberCircleThree,
    NumberCircleFour,
    NumberCircleFive,
    NumberCircleSix,
    NumberCircleSeven,
    NumberCircleEight,
  ];
  const IconComponent = icons[dayNumber - 1] || icons[0];
  return <IconComponent size={24} weight="regular" className="text-[var(--neutral-100)]" aria-hidden="true" />;
}

function RatingDisplay({ info }: { info: ActivityData['googleMapsInfo'] }) {
  if (!info?.rating) return null;
  return (
    <div className="flex items-center gap-1 text-[11px] text-[var(--neutral-60)]">
      <Star size={12} weight="fill" className="text-amber-400" />
      <span className="font-medium text-[var(--neutral-80)]">{info.rating}</span>
      {info.ratingCount && <span>({info.ratingCount.toLocaleString()})</span>}
    </div>
  );
}

function TransportBadge({ activity }: { activity: ActivityData }) {
  const t = activity.transportFromPrevious;
  if (!t || !t.mode) return null;
  const duration = typeof t.duration === 'number' ? `${t.duration} min` : t.duration;
  const distance = typeof t.distance === 'number' ? `${t.distance} km` : t.distance;
  return (
    <div className="flex items-center gap-1.5 py-1.5 px-2 text-[11px] text-[var(--neutral-60)] bg-[var(--neutral-20)] rounded-md mx-auto w-fit">
      <Bus size={12} />
      <span>
        {t.mode}
        {duration ? ` · ${duration}` : ''}
        {distance ? ` · ${distance}` : ''}
      </span>
    </div>
  );
}

function ActivityCard({
  activity,
  index,
  currency,
  onPreviewImage,
}: {
  activity: ActivityData;
  index: number;
  currency?: string;
  onPreviewImage?: (src: string, alt: string) => void;
}) {
  const description = activity.description || activity.details || activity.address || activity.location || '';
  const time = activity.startTime || activity.time || '';
  const locationDisplay =
    activity.coordinates?.placeName ||
    activity.address ||
    activity.location ||
    (activity.coordinates
      ? `${activity.coordinates.lat.toFixed(4)}, ${activity.coordinates.lng.toFixed(4)}`
      : '');

  const imageUrl = getActivityImage(activity);

  return (
    <>
      {index > 0 && <TransportBadge activity={activity} />}
      <div className={cn('flex items-start gap-3', index > 0 && 'border-t border-[var(--neutral-30)] pt-3')}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={activity.name}
            className="h-[72px] w-[72px] md:h-[80px] md:w-[80px] shrink-0 rounded-[8px] object-cover mt-1 cursor-zoom-in"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            onClick={() => onPreviewImage?.(imageUrl, activity.title || activity.name)}
          />
        ) : (
          <div className="h-[72px] w-[72px] md:h-[80px] md:w-[80px] shrink-0 rounded-[8px] mt-1 bg-gradient-to-br from-[var(--primary-surface)] to-[var(--neutral-20)] flex items-center justify-center">
            <MapPin size={24} weight="duotone" className="text-[var(--primary-main)] opacity-50" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[16px] leading-[1.4] font-medium text-[var(--neutral-100)]">
              {activity.title || activity.name}
            </p>
            {activity.estimatedCost && activity.estimatedCost > 0 && (
              <span className="shrink-0 text-[13px] font-medium text-[var(--primary-main)] bg-[var(--primary-surface)] px-2 py-0.5 rounded-full">
                {formatCurrency(activity.estimatedCost, currency)}
              </span>
            )}
          </div>

          {time && (
            <span className="block text-[12px] text-[var(--neutral-60)]">
              {time} • {activity.duration ? `${activity.duration} mins` : activity.type}
            </span>
          )}

          {description && (
            <p className="text-[14px] leading-[1.5] text-[var(--neutral-70)]">{description}</p>
          )}

          {locationDisplay && !description.includes(locationDisplay) && (
            <div className="flex items-start gap-1 mt-1 text-[12px] text-[var(--neutral-60)]">
              <MapPin size={12} weight="fill" className="shrink-0 mt-0.5" />
              <span>{locationDisplay}</span>
            </div>
          )}

          <RatingDisplay info={activity.googleMapsInfo} />
        </div>
      </div>
    </>
  );
}

function DayCard({
  day,
  currency,
  onPreviewImage,
}: {
  day: ItineraryDayData;
  currency?: string;
  onPreviewImage?: (src: string, alt: string) => void;
}) {
  const safeDayNumber = typeof day.dayNumber === 'number' && day.dayNumber > 0 ? day.dayNumber : 1;
  const title = day.title || `Day ${safeDayNumber}`;
  const subtitle = day.theme || day.notes || '';

  return (
    <article className="space-y-3">
      <div className="flex items-center justify-between text-[14px] text-[var(--neutral-70)]">
        <div className="flex items-center gap-2">
          <DayNumberIcon dayNumber={safeDayNumber} />
          <span>{day.date ? formatDate(day.date) : `Day ${safeDayNumber}`}</span>
          {day.weather && (
            <WeatherBadge
              condition={day.weather.condition}
              tempHigh={day.weather.tempHigh}
              tempLow={day.weather.tempLow}
            />
          )}
        </div>
        {day.dailyCost && day.dailyCost > 0 && (
          <span className="font-medium text-[var(--neutral-90)]">{formatCurrency(day.dailyCost, currency)}</span>
        )}
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[var(--neutral-30)]">
        <div className="bg-[var(--neutral-10)] px-3 py-4">
          <div className="mb-4">
            <p className="text-[18px] md:text-[20px] leading-[1.2] font-medium text-[var(--neutral-100)]">{title}</p>
            {subtitle && (
              <p className="text-[14px] leading-[1.5] text-[var(--primary-main)] mt-1 font-medium">{subtitle}</p>
            )}
            {day.meals && (
              <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-[var(--neutral-60)]">
                {day.meals.breakfast && (
                  <span className="bg-[var(--neutral-20)] px-2 py-1 rounded">🍳 {day.meals.breakfast}</span>
                )}
                {day.meals.lunch && (
                  <span className="bg-[var(--neutral-20)] px-2 py-1 rounded">🍱 {day.meals.lunch}</span>
                )}
                {day.meals.dinner && (
                  <span className="bg-[var(--neutral-20)] px-2 py-1 rounded">🍽️ {day.meals.dinner}</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {(day.schedule || day.activities)?.map((activity, index) => (
              <ActivityCard
                key={activity.placeId || `${safeDayNumber}-${index}`}
                activity={activity}
                index={index}
                currency={currency}
                onPreviewImage={onPreviewImage}
              />
            ))}
            {(!day.schedule && !day.activities ||
              (day.schedule || day.activities)?.length === 0) && (
              <p className="text-[14px] text-[var(--neutral-60)] italic">No activities scheduled</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--neutral-30)] bg-[var(--neutral-30)] px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--neutral-70)] transition-colors hover:bg-[var(--neutral-20)] hover:text-[var(--neutral-100)]"
              aria-label="Edit trip day"
            >
              <PencilSimpleLine size={18} weight="regular" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--neutral-70)] transition-colors hover:bg-[var(--neutral-20)] hover:text-[var(--neutral-100)]"
              aria-label="Delete trip day"
            >
              <Trash size={18} weight="regular" />
            </button>
          </div>

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--neutral-70)] transition-colors hover:bg-[var(--neutral-20)] hover:text-[var(--neutral-100)]"
            aria-label="More actions"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyTripToggle({ className }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!isOpen ? (
        <motion.button
          key="closed"
          type="button"
          onClick={() => setIsOpen(true)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 shadow-[6px_6px_32px_rgba(0,0,0,0.06)] hover:bg-[var(--neutral-20)] transition-colors self-start shrink-0',
            className
          )}
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          aria-label="Open trip plan"
        >
          <Sparkle size={16} weight="fill" className="text-[var(--primary-main)]" />
          <span className="text-[13px] font-medium text-[var(--neutral-80)] whitespace-nowrap">Trip Plan</span>
          <CaretDown size={14} weight="bold" className="text-[var(--neutral-50)] -rotate-90" />
        </motion.button>
      ) : (
        <motion.section
          key="open"
          className={cn(
            'flex h-full w-full max-w-[444px] flex-col overflow-hidden rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-[6px_6px_32px_rgba(0,0,0,0.06)]',
            className
          )}
          initial={{ opacity: 0, x: -200 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -200 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1.5 self-end m-3 px-2 py-1 rounded-lg text-[var(--neutral-50)] hover:bg-[var(--neutral-20)] transition-colors"
            aria-label="Close trip plan"
          >
            <CaretDown size={14} weight="bold" className="rotate-90" />
            <span className="text-[12px]">Close</span>
          </button>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 pt-0 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary-lighter)]">
              <Sparkle size={32} weight="fill" className="text-[var(--primary-main)]" />
            </div>
            <div className="space-y-2">
              <h3 className="text-[18px] font-medium text-[var(--neutral-100)]">Your Trip Plan</h3>
              <p className="text-[14px] leading-[1.5] text-[var(--neutral-60)]">
                Ask the AI to create an itinerary and your trip plan will appear here
              </p>
            </div>
            <div className="mt-4 flex flex-col gap-2 text-[13px] text-[var(--neutral-50)]">
              <p>Try asking:</p>
              <p className="italic">&quot;Create a 3-day trip to Da Lat&quot;</p>
              <p className="italic">&quot;Plan a weekend getaway to Phu Quoc&quot;</p>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
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

export default function TripPlanningSideCard({ className }: TripPlanningSideCardProps) {
  const currentItinerary = useChatStore((state) => state.currentItinerary);
  const draftId = useChatStore((state) => state.draftId);
  const isDraftLoading = useChatStore((state) => state.isDraftLoading);
  const isSavingDraft = useChatStore((state) => state.isSavingDraft);
  const loadDraftFromId = useChatStore((state) => state.loadDraftFromId);
  const saveDraft = useChatStore((state) => state.saveDraft);
  const conversationId = useChatStore((state) => state.conversationId);
  const conversationFiles = useChatStore((state) => state.conversationFiles);
  const loadConversationFiles = useChatStore((state) => state.loadConversationFiles);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null);
  const [budgetExpanded, setBudgetExpanded] = useState(false);

  useEffect(() => {
    if (draftId && !isDraftLoading) {
      loadDraftFromId(draftId);
    }
  }, [draftId, isDraftLoading, loadDraftFromId]);

  useEffect(() => {
    if (conversationId) {
      loadConversationFiles(conversationId);
    }
  }, [conversationId, loadConversationFiles]);

  if (isDraftLoading) {
    return (
      <section
        className={cn(
          'flex h-full w-full max-w-[444px] flex-col overflow-hidden rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-[6px_6px_32px_rgba(0,0,0,0.06)]',
          className
        )}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <CircleNotch size={48} weight="bold" className="text-[var(--primary-main)] animate-spin" />
          <div className="space-y-2">
            <h3 className="text-[18px] font-medium text-[var(--neutral-100)]">Loading Trip Plan</h3>
            <p className="text-[14px] leading-[1.5] text-[var(--neutral-60)]">Fetching your trip details...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentItinerary) {
    return <EmptyTripToggle className={className} />;
  }

  const title =
    currentItinerary.tripTitle ||
    (currentItinerary.destination ? `${currentItinerary.destination} Trip` : 'Your Trip Plan');
  const description =
    currentItinerary.overview ||
    currentItinerary.description ||
    (currentItinerary.destination
      ? `${currentItinerary.days?.length || 0} day trip to ${currentItinerary.destination}`
      : 'Explore your personalized itinerary');
  const days = currentItinerary.days || [];

  return (
    <section
      className={cn(
        'flex h-full w-full max-w-[444px] flex-col overflow-hidden rounded-[12px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] shadow-[6px_6px_32px_rgba(0,0,0,0.06)]',
        className
      )}
    >
      {/* Header — compact on mobile */}
      <div className="flex flex-col gap-2 md:gap-4 px-4 md:px-6 py-3 md:py-6">
        <div className="flex items-center gap-2">
          <Sparkle size={16} weight="fill" className="text-[var(--primary-main)] shrink-0" aria-hidden="true" />
          <span className="text-[12px] md:text-[14px] font-medium text-[var(--neutral-60)]">AI Recommendation</span>
        </div>

        <div className="space-y-1 md:space-y-2">
          <h2 className="text-[20px] md:text-[36px] leading-[1.2] font-medium tracking-[-0.02em] text-[var(--neutral-100)]">
            {title}
          </h2>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] md:text-[13px] text-[var(--neutral-60)]">
            {currentItinerary.startDate && currentItinerary.endDate && (
              <span>
                {formatDate(currentItinerary.startDate)} – {formatDate(currentItinerary.endDate)}
              </span>
            )}
            {currentItinerary.travelers && currentItinerary.travelers > 0 && (
              <span>
                • {currentItinerary.travelers} traveler{currentItinerary.travelers > 1 ? 's' : ''}
              </span>
            )}
            {currentItinerary.budget && currentItinerary.budget > 0 && (
              <span>
                •{' '}
                {new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: currentItinerary.currency || 'VND',
                }).format(currentItinerary.budget)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--neutral-30)]" />

      {/* Budget breakdown — collapsible */}
      {currentItinerary.budgetBreakdown &&
        buildBudgetCategories(currentItinerary.budgetBreakdown).length > 0 && (
        <div className="px-4 md:px-6 pt-3 md:pt-4">
          <button
            type="button"
            onClick={() => setBudgetExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between py-1.5 text-[13px] font-medium text-[var(--neutral-80)] hover:text-[var(--neutral-100)] transition-colors"
          >
            <span>Budget Breakdown</span>
            <CaretDown
              size={14}
              weight="bold"
              className={cn(
                'text-[var(--neutral-50)] transition-transform duration-200',
                budgetExpanded && 'rotate-180'
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {budgetExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-2 pb-1">
                  <BudgetBreakdown
                    totalBudget={currentItinerary.budget ?? 0}
                    currency={currentItinerary.currency ?? 'VND'}
                    categories={buildBudgetCategories(currentItinerary.budgetBreakdown)}
                    compact
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Full detailed day cards */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-2 pt-4 md:pt-5 scrollbar-thin">
        <div className="flex flex-col gap-5">
          {days.map((day, index) => (
            <DayCard
              key={`day-${day.dayNumber ?? 'missing'}-${day.date || 'no-date'}-${index}`}
              day={day}
              currency={currentItinerary.currency}
              onPreviewImage={(src, alt) => setPreviewImage({ src, alt })}
            />
          ))}
          {days.length === 0 && (
            <p className="text-center text-[14px] text-[var(--neutral-60)]">No days planned yet</p>
          )}
        </div>
      </div>

      {/* File upload section */}
      <div className="border-t border-[var(--neutral-30)] px-4 md:px-6 py-3 space-y-3">
        <FileDropZone />
        <ConversationFileList files={conversationFiles} />
      </div>

      {/* Confirm & Save button */}
      <div className="sticky bottom-0 border-t border-[var(--neutral-30)] bg-[var(--neutral-10)] px-4 md:px-6 py-4">
        <button
          type="button"
          onClick={() => draftId && saveDraft(draftId)}
          disabled={isSavingDraft || !draftId}
          className="flex w-full items-center justify-center rounded-[10px] bg-[var(--primary-main)] py-3 text-[14px] font-medium text-white hover:bg-[var(--primary-main)]/90 disabled:opacity-60 transition-colors"
        >
          {isSavingDraft ? (
            <CircleNotch className="animate-spin" size={20} />
          ) : (
            'Confirm & Save Plan'
          )}
        </button>
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
    </section>
  );
}
