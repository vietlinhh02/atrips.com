'use client';

import { useState, useCallback } from 'react';
import ExploreDestinationCard from '@/src/components/features/explore/ExploreDestinationCard';
import exploreService from '@/src/services/exploreService';
import type { Destination, Enhancement } from '@/src/services/exploreService';

interface DestinationSectionProps {
  title: string;
  subtitle?: string;
  sectionKey: string;
  initialItems: Destination[];
  initialTotal: number;
  initialHasMore: boolean;
  enhancements?: Record<string, Enhancement>;
  onPlanTrip: (destination: Destination) => void;
  onSave: (destination: Destination) => void;
}

export default function DestinationSection({
  title,
  subtitle,
  sectionKey,
  initialItems,
  initialTotal,
  initialHasMore,
  enhancements = {},
  onPlanTrip,
  onSave,
}: DestinationSectionProps) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);

    try {
      const data = await exploreService.getSection(
        sectionKey,
        8,
        items.length,
      );
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, items.length, sectionKey]);

  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="border-b border-[var(--neutral-30)] pb-4">
        <h2 className="text-[20px] md:text-[24px] font-medium leading-[1.2] text-[var(--neutral-100)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-[14px] text-[var(--neutral-60)]">{subtitle}</p>
        )}
      </div>

      <div className="flex overflow-x-auto pb-4 gap-6 snap-x snap-mandatory hide-scrollbar md:grid md:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
        {items.map((dest, i) => (
          <div key={dest.id} className="min-w-[260px] md:min-w-0 snap-center">
            <ExploreDestinationCard
              destination={dest}
              enhancement={enhancements[dest.id]}
              index={i}
              onPlanTrip={onPlanTrip}
              onSave={onSave}
            />
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="text-[14px] font-medium text-[var(--primary-main)] transition-colors hover:text-[var(--primary-hover)] disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'See More'}
          </button>
        </div>
      )}
    </section>
  );
}
