'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  UsersThree,
  Globe,
  Star,
  Users,
  Bell,
  Heart,
  MapPin,
  Clock,
} from '@phosphor-icons/react';
import { Badge } from '@/src/components/ui/badge';
import { toast } from '@/src/components/ui/use-toast';

interface FeaturePreview {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentColor: string;
  bgColor: string;
}

const FEATURE_PREVIEWS: FeaturePreview[] = [
  {
    icon: <Globe size={24} weight="duotone" />,
    title: 'Shared Trips',
    description:
      'Browse public itineraries from travelers worldwide',
    accentColor: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950/40',
  },
  {
    icon: <Star size={24} weight="duotone" />,
    title: 'Trip Reviews',
    description:
      'Rate and review destinations, hotels, and activities',
    accentColor: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
  },
  {
    icon: <Users size={24} weight="duotone" />,
    title: 'Travel Groups',
    description:
      'Join interest-based groups and plan together',
    accentColor: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950/40',
  },
];

interface MockTrip {
  title: string;
  author: string;
  rating: number;
  duration: string;
  imageUrl: string;
  likes: number;
  location: string;
}

const MOCK_TRIPS: MockTrip[] = [
  {
    title: '3 Days in Kyoto',
    author: '@travel_lover',
    rating: 4.8,
    duration: '3 days',
    imageUrl:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=80',
    likes: 234,
    location: 'Kyoto, Japan',
  },
  {
    title: 'Bali Adventure Week',
    author: '@wanderer',
    rating: 4.5,
    duration: '7 days',
    imageUrl:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600&q=80',
    likes: 189,
    location: 'Bali, Indonesia',
  },
  {
    title: 'Paris on a Budget',
    author: '@budget_queen',
    rating: 4.9,
    duration: '5 days',
    imageUrl:
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
    likes: 312,
    location: 'Paris, France',
  },
  {
    title: 'Vietnam Food Tour',
    author: '@foodie_vn',
    rating: 4.7,
    duration: '10 days',
    imageUrl:
      'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=80',
    likes: 276,
    location: 'Hanoi, Vietnam',
  },
];

const INTEREST_OPTIONS = [
  'Shared trip browsing',
  'Trip rating & reviews',
  'Travel buddy matching',
  'Group trip planning',
] as const;

function FeatureCard({
  feature,
  index,
}: {
  feature: FeaturePreview;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
      className="flex flex-col items-center rounded-2xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] p-6 text-center shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
    >
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full ${feature.bgColor} ${feature.accentColor}`}
      >
        {feature.icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-[var(--neutral-100)]">
        {feature.title}
      </h3>
      <p className="text-sm leading-relaxed text-[var(--neutral-60)]">
        {feature.description}
      </p>
    </motion.div>
  );
}

function MockTripCard({
  trip,
  index,
}: {
  trip: MockTrip;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 0.5, y: 0 }}
      transition={{ duration: 0.35, delay: 0.6 + index * 0.1 }}
      className="overflow-hidden rounded-2xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] opacity-50"
    >
      <div className="relative h-36 w-full">
        <Image
          src={trip.imageUrl}
          alt={trip.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-2 left-3 flex items-center gap-1 text-white">
          <MapPin size={12} weight="fill" />
          <span className="text-xs font-medium">
            {trip.location}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h4 className="mb-1 text-sm font-semibold text-[var(--neutral-100)]">
          {trip.title}
        </h4>
        <p className="mb-3 text-xs text-[var(--neutral-60)]">
          by {trip.author}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-amber-500">
              <Star size={12} weight="fill" />
              {trip.rating}
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--neutral-60)]">
              <Clock size={12} />
              {trip.duration}
            </span>
            <span className="flex items-center gap-1 text-xs text-[var(--neutral-60)]">
              <Heart size={12} />
              {trip.likes}
            </span>
          </div>
        </div>
        <button
          disabled
          className="mt-3 w-full rounded-lg bg-[var(--neutral-30)] px-3 py-1.5 text-xs font-medium text-[var(--neutral-50)] cursor-not-allowed"
        >
          View Trip
        </button>
      </div>
    </motion.div>
  );
}

function CommunityContent() {
  const [selectedInterests, setSelectedInterests] = useState<
    Set<string>
  >(new Set());

  function toggleInterest(option: string) {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(option)) {
        next.delete(option);
      } else {
        next.add(option);
      }
      return next;
    });
  }

  function handleGetNotified() {
    toast.success(
      "You'll be notified when Community launches!",
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-8 md:px-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-2 flex items-center gap-3"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-surface)]">
          <UsersThree
            size={20}
            weight="fill"
            className="text-[var(--primary-main)]"
          />
        </div>
        <h2 className="text-xl font-semibold text-[var(--neutral-100)]">
          Community
        </h2>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="mb-8 text-sm text-[var(--neutral-60)]"
      >
        Discover trips shared by fellow travelers
      </motion.p>

      {/* Feature preview cards */}
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURE_PREVIEWS.map((feature, i) => (
          <FeatureCard
            key={feature.title}
            feature={feature}
            index={i}
          />
        ))}
      </div>

      {/* Coming soon banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="mb-10 flex flex-col items-center rounded-2xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-6 py-10 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
      >
        <Badge
          variant="secondary"
          className="mb-4 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 text-[11px] font-semibold tracking-wide uppercase px-3 py-1"
        >
          Coming Soon
        </Badge>
        <h3 className="mb-2 text-lg font-semibold text-[var(--neutral-100)]">
          We&apos;re building something amazing
        </h3>
        <p className="mb-6 max-w-lg text-center text-sm leading-relaxed text-[var(--neutral-60)]">
          The community hub will let you discover shared
          trips, follow travelers, and get inspired by real
          experiences.
        </p>
        <button
          onClick={handleGetNotified}
          className="flex items-center gap-2 rounded-full bg-[var(--primary-main)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
        >
          <Bell size={16} weight="fill" />
          Get Notified
        </button>
      </motion.div>

      {/* Preview shared trips */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="mb-10"
      >
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-[var(--neutral-50)]">
          Preview - Real trips coming soon
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MOCK_TRIPS.map((trip, i) => (
            <MockTripCard
              key={trip.title}
              trip={trip}
              index={i}
            />
          ))}
        </div>
      </motion.div>

      {/* Interest section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="flex flex-col items-center rounded-2xl border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-6 py-8 shadow-[6px_6px_32px_0px_rgba(0,0,0,0.04)]"
      >
        <h3 className="mb-1 text-base font-semibold text-[var(--neutral-100)]">
          What would you like to see?
        </h3>
        <p className="mb-5 text-sm text-[var(--neutral-60)]">
          Let us know what features matter most to you
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {INTEREST_OPTIONS.map((option) => {
            const isSelected = selectedInterests.has(option);
            return (
              <button
                key={option}
                onClick={() => toggleInterest(option)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-[var(--primary-main)] text-white'
                    : 'bg-[var(--neutral-20)] text-[var(--neutral-70)] hover:bg-[var(--neutral-30)]'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

export default function CommunityPage() {
  return <CommunityContent />;
}
