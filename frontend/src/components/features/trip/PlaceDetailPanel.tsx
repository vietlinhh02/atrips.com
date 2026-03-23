'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Globe,
  MapPin,
  Phone,
  Star,
} from '@phosphor-icons/react';
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

export default function PlaceDetailPanel({
  placeId,
  activityData,
  onClose,
}: PlaceDetailPanelProps) {
  const [place, setPlace] = useState<EnrichedPlace | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placeId) return;
    setLoading(true);
    placeService
      .enrichPlace(placeId)
      .then(setPlace)
      .catch(() => {
        // Use activity data as fallback
      })
      .finally(() => setLoading(false));
  }, [placeId]);

  const photos = place?.photos?.length
    ? place.photos
    : activityData.photos?.length
      ? activityData.photos
      : activityData.imageUrl
        ? [activityData.imageUrl]
        : [];

  const name = place?.name || activityData.name;
  const address = place?.address || activityData.address;
  const rating = place?.rating;
  const ratingCount = place?.ratingCount;
  const enriched = place?.enrichedData;

  return (
    <div className="flex h-full flex-col bg-[var(--neutral-10)] border-l border-[var(--neutral-30)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--neutral-30)] bg-[var(--neutral-10)] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 hover:bg-[var(--neutral-20)] transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h3 className="text-sm font-semibold text-[var(--neutral-100)] line-clamp-1">
          {name}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Image Gallery */}
        {photos.length > 0 && (
          <div className="flex gap-1 overflow-x-auto p-1">
            {photos.slice(0, 5).map((url, i) => (
              <img
                key={i}
                src={url}
                alt={`${name} ${i + 1}`}
                className="h-[160px] min-w-[200px] rounded-lg object-cover"
              />
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-[var(--primary-main)] border-t-transparent rounded-full" />
          </div>
        )}

        <div className="space-y-4 p-4">
          {/* Rating */}
          {rating != null && (
            <div className="flex items-center gap-2">
              <Star
                size={16}
                weight="fill"
                className="text-amber-400"
              />
              <span className="text-sm font-medium">
                {rating.toFixed(1)}
              </span>
              {ratingCount != null && (
                <span className="text-xs text-[var(--neutral-60)]">
                  ({ratingCount} reviews)
                </span>
              )}
            </div>
          )}

          {/* Address */}
          {address && (
            <div className="flex items-start gap-2">
              <MapPin
                size={16}
                className="mt-0.5 shrink-0 text-[var(--neutral-60)]"
              />
              <span className="text-sm text-[var(--neutral-80)]">
                {address}
              </span>
            </div>
          )}

          {/* Opening Hours */}
          {enriched?.openingHours && (
            <div className="flex items-start gap-2">
              <Clock
                size={16}
                className="mt-0.5 shrink-0 text-[var(--neutral-60)]"
              />
              <span className="text-sm text-[var(--neutral-80)]">
                {enriched.openingHours}
              </span>
            </div>
          )}

          {/* Phone */}
          {place?.phone && (
            <div className="flex items-center gap-2">
              <Phone
                size={16}
                className="text-[var(--neutral-60)]"
              />
              <a
                href={`tel:${place.phone}`}
                className="text-sm text-[var(--primary-main)]"
              >
                {place.phone}
              </a>
            </div>
          )}

          {/* Website */}
          {place?.website && (
            <div className="flex items-center gap-2">
              <Globe
                size={16}
                className="text-[var(--neutral-60)]"
              />
              <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--primary-main)] truncate"
              >
                {place.website}
              </a>
            </div>
          )}

          {/* Description */}
          {(enriched?.description || activityData.description) && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--neutral-60)] uppercase mb-1">
                About
              </h4>
              <p className="text-sm text-[var(--neutral-80)]">
                {enriched?.description || activityData.description}
              </p>
            </div>
          )}

          {/* Cost */}
          {activityData.estimatedCost != null && (
            <div>
              <h4 className="text-xs font-semibold text-[var(--neutral-60)] uppercase mb-1">
                Estimated Cost
              </h4>
              <p className="text-sm font-medium text-[var(--neutral-100)]">
                {activityData.estimatedCost.toLocaleString()}{' '}
                {activityData.currency || 'USD'}
              </p>
            </div>
          )}

          {/* Review Snippets */}
          {enriched?.reviewSnippets &&
            enriched.reviewSnippets.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[var(--neutral-60)] uppercase mb-2">
                  Reviews
                </h4>
                <div className="space-y-2">
                  {enriched.reviewSnippets.map((review, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-[var(--neutral-20)] p-3"
                    >
                      <p className="text-xs text-[var(--neutral-80)]">
                        &ldquo;{review.text}&rdquo;
                      </p>
                      <a
                        href={review.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-[10px] text-[var(--primary-main)]"
                      >
                        {review.title}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Google Maps Link */}
          {place?.latitude && place?.longitude && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-[var(--neutral-30)] py-2.5 text-sm font-medium text-[var(--neutral-80)] hover:bg-[var(--neutral-20)] transition-colors"
            >
              <MapPin size={16} />
              Open in Google Maps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
