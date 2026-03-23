'use client';

import { Star } from '@phosphor-icons/react';

interface MapMarkerPopupProps {
  name: string;
  type?: string;
  imageUrl?: string;
  rating?: number | null;
  ratingCount?: number | null;
  onViewDetails: () => void;
}

export default function MapMarkerPopup({
  name,
  type,
  imageUrl,
  rating,
  ratingCount,
  onViewDetails,
}: MapMarkerPopupProps) {
  return (
    <div className="w-[240px] overflow-hidden rounded-lg bg-[var(--neutral-10)] shadow-lg">
      {imageUrl && (
        <img
          src={imageUrl}
          alt={name}
          className="h-[100px] w-full object-cover"
        />
      )}
      <div className="p-3">
        <h4 className="text-sm font-semibold text-[var(--neutral-100)] line-clamp-1">
          {name}
        </h4>
        <div className="mt-1 flex items-center gap-2">
          {type && (
            <span className="rounded bg-[var(--neutral-20)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--neutral-60)]">
              {type}
            </span>
          )}
          {rating != null && (
            <span className="flex items-center gap-0.5 text-xs text-[var(--neutral-70)]">
              <Star size={12} weight="fill" className="text-amber-400" />
              {rating.toFixed(1)}
              {ratingCount != null && (
                <span className="text-[var(--neutral-50)]">
                  ({ratingCount})
                </span>
              )}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onViewDetails}
          className="mt-2 w-full rounded-md bg-[var(--primary-main)] py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
        >
          View details
        </button>
      </div>
    </div>
  );
}
