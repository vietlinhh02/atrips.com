'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  CurrencyCircleDollar,
  CalendarBlank,
  PaperPlaneTilt,
} from '@phosphor-icons/react';
import type { Destination, Enhancement } from '@/src/services/exploreService';

interface ExploreDestinationCardProps {
  destination: Destination;
  enhancement?: Enhancement;
  index?: number;
  onPlanTrip: (destination: Destination) => void;
  onSave: (destination: Destination) => void;
}

export default function ExploreDestinationCard({
  destination,
  enhancement,
  index = 0,
  onPlanTrip,
}: ExploreDestinationCardProps) {
  const router = useRouter();
  const place = destination.cached_place;
  const imageUrl = place.photos?.[0] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => router.push(`/explore/${destination.id}`)}
      className="group flex h-[302px] cursor-pointer flex-col overflow-hidden rounded-[10px] border border-[var(--neutral-30)] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:bg-[var(--neutral-20)]"
    >
      {/* Image */}
      <div className="relative h-[160px] overflow-hidden border-b border-[var(--neutral-30)]">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`${place.city}, ${place.country}`}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-[var(--neutral-10)] to-[var(--neutral-20)]">
            <MapPin size={32} weight="duotone" className="text-[var(--neutral-40)]" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 px-3 py-2.5">
        <div className="flex flex-col gap-1">
          <h3 className="text-[16px] font-medium leading-[1.2] text-[var(--neutral-100)]">
            {place.city}, {place.country}
          </h3>
          <p className="line-clamp-2 text-[12px] leading-[1.5] text-[var(--neutral-70)]">
            {enhancement?.personalizedTagline ?? destination.tagline ?? ''}
          </p>
        </div>

        {/* Details */}
        <div className="flex items-center gap-2 text-[12px] text-[var(--neutral-70)]">
          {destination.avgDailyBudget && (
            <div className="flex items-center gap-1">
              <CurrencyCircleDollar className="h-4 w-4" />
              <span>~${Number(destination.avgDailyBudget)}/day</span>
            </div>
          )}
          {destination.avgDailyBudget && destination.bestSeasons.length > 0 && (
            <div className="mx-1 h-3 w-px bg-[var(--neutral-30)]" />
          )}
          {destination.bestSeasons.length > 0 && (
            <div className="flex items-center gap-1">
              <CalendarBlank className="h-4 w-4" />
              <span>{destination.bestSeasons.slice(0, 2).join(', ')}</span>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlanTrip(destination);
          }}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--primary-main)] py-2 text-[12px] font-medium text-white shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)] transition-colors hover:bg-[var(--primary-hover)]"
        >
          <PaperPlaneTilt size={14} weight="fill" />
          Plan Trip
        </button>
      </div>
    </motion.div>
  );
}
