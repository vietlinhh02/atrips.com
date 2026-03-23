'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import {
  ArrowLeft,
  BookmarkSimple,
  CalendarBlank,
  CaretDown,
  CloudRain,
  FlowerTulip,
  Globe,
  MapPin,
  Phone,
  Plus,
  Star,
  SunDim,
  Wind,
} from '@phosphor-icons/react';

import { cn } from '@/src/lib/utils';

interface TravelAdviceItem {
  season: 'Spring' | 'Summer' | 'Fall' | 'Winter';
  description: string;
}

interface DestinationDetailCardProps {
  className?: string;
  title?: string;
  mentionCount?: string;
  summary?: string;
  address?: string;
  city?: string;
  type?: string;
  website?: string;
  phone?: string;
  rating?: number;
  ratingCount?: number;
  openingHours?: string | null;
  categories?: string[];
  dateRangeLabel?: string;
  travelersLabel?: string;
  tabs?: string[];
  travelAdvice?: TravelAdviceItem[];
  mainImageUrl?: string;
  sideTopImageUrl?: string;
  sideBottomImageUrl?: string;
  onClose?: () => void;
}

const defaultAdvice: TravelAdviceItem[] = [
  {
    season: 'Spring',
    description:
      'Spring is warm and pleasant, making it a great time for outdoor activities and exploring natural beauty.',
  },
  {
    season: 'Summer',
    description:
      'Summer is the peak tourist season with warm temperatures and vibrant culture festivals.',
  },
  {
    season: 'Fall',
    description:
      'Fall sees fewer tourists, offering a more relaxed experience. The weather remains warm for sightseeing.',
  },
  {
    season: 'Winter',
    description:
      'Winter brings cooler weather and fewer crowds. A good season for budget travelers.',
  },
];

const PLACEHOLDER_MAIN = 'https://images.unsplash.com/photo-1537953773345-d172ccf13cf1?auto=format&fit=crop&w=700&q=80';
const PLACEHOLDER_SIDE_TOP = 'https://images.unsplash.com/photo-1555400082-ef485c3d8b0a?auto=format&fit=crop&w=300&q=80';
const PLACEHOLDER_SIDE_BOTTOM = 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=300&q=80';

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    restaurant: 'Restaurant',
    hotel: 'Hotel',
    attraction: 'Attraction',
    cafe: 'Cafe',
    shopping: 'Shopping',
    entertainment: 'Entertainment',
    activity: 'Activity',
  };
  return (
    <span className="inline-flex items-center rounded-[4px] bg-[var(--primary-surface)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--primary-main)]">
      {labels[type?.toLowerCase()] || type}
    </span>
  );
}

export default function DestinationDetailCard({
  className,
  title = 'Destination',
  mentionCount,
  summary,
  address,
  city,
  type,
  website,
  phone,
  rating,
  ratingCount,
  openingHours,
  categories = [],
  dateRangeLabel = 'Select dates',
  travelersLabel = '1 Adult',
  tabs = ['Overview', 'Guides', 'Stays', 'Restaurants', 'Things to Do', 'Location'],
  travelAdvice = defaultAdvice,
  mainImageUrl,
  sideTopImageUrl,
  sideBottomImageUrl,
  onClose,
}: DestinationDetailCardProps) {
  const [activeTab, setActiveTab] = useState(tabs[0] ?? 'Overview');

  const mainImg = mainImageUrl || PLACEHOLDER_MAIN;
  const sideTopImg = sideTopImageUrl || PLACEHOLDER_SIDE_TOP;
  const sideBottomImg = sideBottomImageUrl || PLACEHOLDER_SIDE_BOTTOM;

  const descriptionText =
    summary ||
    (categories.length > 0 ? categories.join(' · ') : null) ||
    (address ? `Located at ${address}` : null) ||
    'A wonderful place to visit.';

  return (
    <section
      className={cn(
        'relative flex h-full max-h-[875px] w-full max-w-[453px] flex-col overflow-y-auto rounded-[10px] bg-[var(--neutral-10)] p-8 shadow-[6px_6px_32px_rgba(0,0,0,0.06)] scrollbar-thin',
        className
      )}
    >
      {/* Close / back button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="mb-4 flex items-center gap-1.5 self-start text-[13px] text-[var(--neutral-60)] hover:text-[var(--neutral-100)] transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      )}

      {/* Images */}
      <div className="flex gap-3">
        <img
          src={mainImg}
          alt={title}
          className="h-[257px] w-[257px] shrink-0 rounded-[10px] object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_MAIN; }}
        />
        <div className="flex flex-col gap-3">
          <img
            src={sideTopImg}
            alt={`${title} view 2`}
            className="h-[122px] w-[122px] rounded-[10px] object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_SIDE_TOP; }}
          />
          <div className="relative">
            <img
              src={sideBottomImg}
              alt={`${title} view 3`}
              className="h-[122px] w-[122px] rounded-[10px] object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_SIDE_BOTTOM; }}
            />
            <div className="absolute inset-0 rounded-[10px] bg-[rgba(16,16,16,0.5)] backdrop-blur-[4px]" />
            <span className="absolute inset-0 flex items-center justify-center text-[16px] font-medium text-white">
              See More
            </span>
          </div>
        </div>
      </div>

      {/* Title + meta */}
      <div className="mt-6 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[24px] font-medium leading-[1.2] text-[var(--neutral-100)]">{title}</h2>
          {type && <TypeBadge type={type} />}
        </div>

        {/* Rating */}
        {rating != null && (
          <div className="flex items-center gap-1.5 text-[13px]">
            <Star size={14} weight="fill" className="text-amber-400" />
            <span className="font-medium text-[var(--neutral-100)]">{rating.toFixed(1)}</span>
            {ratingCount != null && (
              <span className="text-[var(--neutral-60)]">({ratingCount.toLocaleString()} reviews)</span>
            )}
          </div>
        )}

        {/* Address */}
        {(address || city) && (
          <div className="flex items-start gap-1.5 text-[13px] text-[var(--neutral-60)]">
            <MapPin size={14} weight="fill" className="mt-0.5 shrink-0 text-[var(--primary-main)]" />
            <span>{address || city}</span>
          </div>
        )}

        {/* Contact links */}
        <div className="flex flex-wrap gap-3">
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[12px] text-[var(--primary-main)] hover:underline"
            >
              <Globe size={13} />
              Website
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-1 text-[12px] text-[var(--neutral-70)] hover:underline"
            >
              <Phone size={13} />
              {phone}
            </a>
          )}
          {openingHours && (
            <span className="text-[12px] text-[var(--neutral-60)]">
              🕐 {typeof openingHours === 'string' ? openingHours : 'See hours'}
            </span>
          )}
        </div>

        {/* Mention count */}
        {mentionCount && (
          <div className="flex items-center gap-1 text-[14px]">
            <BookmarkSimple size={16} weight="fill" className="text-[#073e71]" />
            <span className="font-medium text-[var(--neutral-100)]">{mentionCount}</span>
            <span className="text-[var(--neutral-60)]">People Mention This Place</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="relative mt-4 border-b border-[var(--neutral-30)]">
        <div className="flex items-center gap-1 overflow-x-auto pb-1.5 pr-6 scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'whitespace-nowrap rounded-[4px] px-3 py-1.5 text-[14px] leading-[1.5] transition-colors',
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
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white to-transparent" />
      </div>

      {/* Description */}
      <p className="mt-6 text-[14px] leading-[1.5] text-[var(--neutral-60)]">
        {descriptionText}
      </p>

      {/* Booking widget */}
      <div className="mt-6 rounded-[10px] border border-[var(--neutral-30)] p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-1 rounded-[8px] border border-[var(--neutral-40)] px-3 py-2 text-[14px] text-[var(--neutral-100)]">
            <CalendarBlank size={16} className="text-[var(--neutral-70)]" />
            <span>{dateRangeLabel}</span>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-1 rounded-[8px] border border-[var(--neutral-40)] px-3 py-2 text-[14px] text-[var(--neutral-100)]"
          >
            <span>{travelersLabel}</span>
            <CaretDown size={14} className="text-[var(--neutral-60)]" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-[10px] bg-[#073e71] px-3 py-2 text-[12px] font-medium text-white shadow-[6px_6px_32px_rgba(0,0,0,0.06)] hover:bg-[#073e71]/90"
          >
            Book
          </button>
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-2 rounded-[10px] border border-[var(--neutral-30)] px-3 py-2 text-[12px] font-medium text-[var(--neutral-80)] hover:bg-[var(--neutral-20)]"
          >
            <Plus size={14} />
            Add to Trip
          </button>
        </div>
      </div>

      {/* Travel Advice (only shown if provided) */}
      {travelAdvice.length > 0 && (
        <div className="mt-7">
          <h3 className="text-[18px] font-medium leading-[1.2] text-[var(--neutral-100)]">Travel Advice</h3>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {travelAdvice.map((item) => (
              <article key={item.season} className="space-y-1">
                <div className="flex items-center gap-1.5 text-[14px] font-medium text-[var(--neutral-100)]">
                  {item.season === 'Spring' && <FlowerTulip size={15} className="text-[var(--neutral-80)]" />}
                  {item.season === 'Summer' && <SunDim size={15} className="text-[var(--neutral-80)]" />}
                  {item.season === 'Fall' && <Wind size={15} className="text-[var(--neutral-80)]" />}
                  {item.season === 'Winter' && <CloudRain size={15} className="text-[var(--neutral-80)]" />}
                  <span>{item.season}</span>
                </div>
                <p className="pl-[23px] text-[14px] leading-[1.5] text-[var(--neutral-60)]">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
