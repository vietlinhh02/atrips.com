'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  CurrencyDollar,
  Globe,
  Images,
  MapPin,
  Phone,
  Star,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/src/lib/utils';
import placeService, {
  type EnrichedPlace,
} from '@/src/services/placeService';

interface PlaceDetailPanelProps {
  placeId: string | null;
  activityData: {
    name: string;
    type?: string;
    estimatedCost?: number;
    currency?: string;
    description?: string;
    address?: string;
    imageUrl?: string;
    photos?: string[];
  };
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  HOTEL: 'Hotel',
  RESTAURANT: 'Restaurant',
  ATTRACTION: 'Attraction',
  ACTIVITY: 'Activity',
  TRANSPORT: 'Transport',
  SHOPPING: 'Shopping',
  OTHER: 'Place',
};

const PLACEHOLDER =
  'https://images.unsplash.com/photo-1488085061387-422e29b40080?auto=format&fit=crop&w=700&q=80';

function formatCurrency(amount: number, currency = 'VND'): string {
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

function PriceLevelDots({ level }: { level: string | null | undefined }) {
  if (!level) return null;
  const map: Record<string, number> = {
    BUDGET: 1, MID_RANGE: 2, LUXURY: 3,
    budget: 1, 'mid-range': 2, luxury: 3,
  };
  const count = map[level] ?? 0;
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-[13px] font-medium text-emerald-600">
      {Array.from({ length: 3 }, (_, i) => (
        <CurrencyDollar
          key={i}
          size={14}
          weight={i < count ? 'fill' : 'regular'}
          className={i < count ? 'text-emerald-600' : 'text-[var(--neutral-40)]'}
        />
      ))}
    </span>
  );
}

function ReviewSourceBadge({ source }: { source: string }) {
  if (source.includes('tripadvisor'))
    return <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">TripAdvisor</span>;
  if (source.includes('google'))
    return <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Google</span>;
  if (source.includes('yelp'))
    return <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Yelp</span>;
  return <span className="text-[10px] font-medium text-[var(--neutral-50)] bg-[var(--neutral-20)] px-1.5 py-0.5 rounded">Review</span>;
}

function ImageGrid({
  photos,
  name,
  onShowGallery,
}: {
  photos: string[];
  name: string;
  onShowGallery: () => void;
}) {
  if (photos.length === 0) {
    return (
      <div className="flex h-[257px] items-center justify-center rounded-[10px] bg-[var(--neutral-20)]">
        <Images size={48} className="text-[var(--neutral-40)]" />
      </div>
    );
  }

  const main = photos[0] ?? PLACEHOLDER;
  const sideTop = photos[1];
  const sideBottom = photos[2];

  if (!sideTop) {
    return (
      <img
        src={main}
        alt={name}
        className="h-[257px] w-full rounded-[10px] object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
      />
    );
  }

  return (
    <div className="flex gap-3">
      <img
        src={main}
        alt={name}
        className="h-[257px] min-w-0 flex-1 rounded-[10px] object-cover"
        onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
      />
      <div className="flex w-[122px] shrink-0 flex-col gap-3">
        <img
          src={sideTop}
          alt={`${name} view 2`}
          className="h-[122px] w-[122px] rounded-[10px] object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        {sideBottom ? (
          <button type="button" onClick={onShowGallery} className="relative h-[122px] w-[122px]">
            <img
              src={sideBottom}
              alt={`${name} view 3`}
              className="h-full w-full rounded-[10px] object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
            />
            {photos.length > 3 && (
              <>
                <div className="absolute inset-0 rounded-[10px] bg-[rgba(16,16,16,0.5)] backdrop-blur-[4px]" />
                <span className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-white">
                  See More
                </span>
              </>
            )}
          </button>
        ) : (
          <div className="h-[122px] w-[122px] rounded-[10px] bg-[var(--neutral-20)]" />
        )}
      </div>
    </div>
  );
}

function GalleryModal({
  photos,
  name,
  onClose,
}: {
  photos: string[];
  name: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-white">
          {name} — {photos.length} photos
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
          aria-label="Close gallery"
        >
          <ArrowLeft size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
        <div className="columns-2 gap-2 max-w-[800px] mx-auto">
          {photos.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${name} ${i + 1}`}
              className="mb-2 w-full rounded-lg object-cover break-inside-avoid"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function PlaceDetailPanel({
  placeId,
  activityData,
  onClose,
}: PlaceDetailPanelProps) {
  const [place, setPlace] = useState<EnrichedPlace | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  const lookupKey = placeId ?? activityData.name ?? '';

  useEffect(() => {
    if (!lookupKey) return;

    let cancelled = false;

    const fetchPlace = async () => {
      try {
        const result = placeId
          ? await placeService.enrichPlace(placeId)
          : await placeService.lookupPlace(lookupKey);
        if (!cancelled) setPlace(result);
      } catch {
        /* fallback to activityData */
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    setPlace(null);
    void fetchPlace();

    return () => { cancelled = true; };
  }, [lookupKey, placeId]);

  const photos = place?.photos?.length
    ? place.photos
    : activityData.photos?.length
      ? activityData.photos
      : activityData.imageUrl
        ? [activityData.imageUrl]
        : [];

  const name = place?.name || activityData.name;
  const placeType = (place?.type || activityData.type || 'OTHER').toUpperCase();
  const address = place?.address || activityData.address;
  const rating = place?.rating;
  const ratingCount = place?.ratingCount;
  const enriched = place?.enrichedData;
  const categories = place?.categories ?? [];
  const description = enriched?.description || activityData.description;
  const mapsUrl = place?.latitude && place?.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
    : null;

  return (
    <section
      className={cn(
        'flex h-full w-full max-w-[453px] flex-col overflow-y-auto',
        'rounded-[10px] bg-[var(--neutral-10)] p-8 shadow-[6px_6px_32px_rgba(0,0,0,0.06)] scrollbar-thin'
      )}
    >
      {/* Back button */}
      <button
        type="button"
        onClick={onClose}
        className="mb-4 flex items-center gap-1.5 self-start text-[13px] text-[var(--neutral-60)] hover:text-[var(--neutral-100)] transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      {/* Image Grid */}
      <ImageGrid photos={photos} name={name} onShowGallery={() => setShowGallery(true)} />

      {/* Loading */}
      {loading && (
        <div className="mt-4 flex items-center justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-[var(--primary-main)] border-t-transparent rounded-full" />
        </div>
      )}

      {/* Title + Meta */}
      <div className="mt-6 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[24px] font-medium leading-[1.2] text-[var(--neutral-100)]">{name}</h2>
          <span className="inline-flex shrink-0 items-center rounded-[4px] bg-[var(--primary-surface)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--primary-main)]">
            {TYPE_LABELS[placeType] || TYPE_LABELS.OTHER}
          </span>
        </div>

        {/* Rating */}
        {rating != null && (
          <div className="flex items-center gap-1.5 text-[13px]">
            <Star size={14} weight="fill" className="text-amber-400" />
            <span className="font-medium text-[var(--neutral-100)]">{rating.toFixed(1)}</span>
            {ratingCount != null && (
              <span className="text-[var(--neutral-60)]">({ratingCount.toLocaleString()} reviews)</span>
            )}
            <PriceLevelDots level={place?.priceLevel} />
          </div>
        )}

        {/* Address */}
        {address && (
          <div className="flex items-start gap-1.5 text-[13px] text-[var(--neutral-60)]">
            <MapPin size={14} weight="fill" className="mt-0.5 shrink-0 text-[var(--primary-main)]" />
            <span>{address}</span>
          </div>
        )}

        {/* Contact links */}
        <div className="flex flex-wrap gap-3">
          {place?.website && (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] text-[var(--primary-main)] hover:underline"
            >
              <Globe size={13} />
              Website
            </a>
          )}
          {place?.phone && (
            <a
              href={`tel:${place.phone}`}
              className="flex items-center gap-1 text-[12px] text-[var(--neutral-70)] hover:underline"
            >
              <Phone size={13} />
              {place.phone}
            </a>
          )}
          {enriched?.openingHours && (
            <span className="flex items-center gap-1 text-[12px] text-[var(--neutral-60)]">
              <Clock size={13} />
              {enriched.openingHours}
            </span>
          )}
        </div>

        {/* Estimated Cost */}
        {activityData.estimatedCost != null && activityData.estimatedCost > 0 && (
          <div className="flex items-center gap-1 text-[14px]">
            <CurrencyDollar size={16} weight="fill" className="text-emerald-600" />
            <span className="font-medium text-[var(--neutral-100)]">
              {formatCurrency(activityData.estimatedCost, activityData.currency)}
            </span>
            <span className="text-[var(--neutral-60)]">estimated</span>
          </div>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {categories.slice(0, 5).map((cat) => (
              <span
                key={cat}
                className="rounded-full bg-[var(--neutral-20)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--neutral-70)]"
              >
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="mt-6 text-[14px] leading-[1.5] text-[var(--neutral-60)]">
          {description}
        </p>
      )}

      {/* Reviews */}
      {enriched?.reviewSnippets && enriched.reviewSnippets.length > 0 && (
        <div className="mt-7">
          <h3 className="text-[18px] font-medium leading-[1.2] text-[var(--neutral-100)]">Reviews</h3>
          <div className="mt-4 space-y-3">
            {enriched.reviewSnippets.map((review, i) => (
              <a
                key={i}
                href={review.source}
                target="_blank"
                rel="noopener noreferrer"
                className="block space-y-1.5 rounded-[10px] border border-[var(--neutral-30)] p-4 hover:border-[var(--neutral-40)] hover:shadow-sm transition-all"
              >
                <p className="text-[14px] leading-[1.5] text-[var(--neutral-60)] italic">
                  &ldquo;{review.text.length > 200 ? `${review.text.slice(0, 200)}...` : review.text}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <ReviewSourceBadge source={review.source} />
                  <span className="text-[11px] text-[var(--neutral-50)] truncate max-w-[180px]">
                    {review.title}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Google Maps button */}
      {mapsUrl && (
        <div className="mt-6 flex gap-2">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-[var(--neutral-30)] px-3 py-2 text-[12px] font-medium text-[var(--neutral-80)] hover:bg-[var(--neutral-20)] transition-colors"
          >
            <MapPin size={14} />
            Open in Google Maps
          </a>
        </div>
      )}

      {/* Gallery modal */}
      <AnimatePresence>
        {showGallery && (
          <GalleryModal
            photos={photos}
            name={name}
            onClose={() => setShowGallery(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
