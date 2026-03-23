'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  MapPin,
  CurrencyCircleDollar,
  CalendarBlank,
  Star,
  ArrowLeft,
  PaperPlaneTilt,
  BookmarkSimple,
  Lightbulb,
  Bed,
  ForkKnife,
  Car,
  Ticket,
  Sun,
  ThermometerSimple,
} from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import ExploreDestinationCard from '@/src/components/features/explore/ExploreDestinationCard';
import type {
  Destination,
  WeatherData,
  DestinationEnrichment,
} from '@/src/services/exploreService';

interface DestinationDetailProps {
  destination: Destination;
  weather: WeatherData | null;
  enrichment: DestinationEnrichment | null;
  similarDestinations: Destination[];
  onPlanTrip: (destination: Destination) => void;
  onSave: (destination: Destination) => void;
}

const TAG_COLORS: Record<string, string> = {
  culture: 'bg-purple-100 text-purple-700',
  beach: 'bg-blue-100 text-blue-700',
  food: 'bg-orange-100 text-orange-700',
  adventure: 'bg-green-100 text-green-700',
  nightlife: 'bg-pink-100 text-pink-700',
  nature: 'bg-emerald-100 text-emerald-700',
  history: 'bg-amber-100 text-amber-700',
  shopping: 'bg-rose-100 text-rose-700',
  romantic: 'bg-red-100 text-red-700',
  family: 'bg-sky-100 text-sky-700',
};

function getWeatherEmoji(code: number): string {
  if (code === 0 || code === 1) return '\u2600\uFE0F';
  if (code === 2) return '\u26C5';
  if (code === 3) return '\u2601\uFE0F';
  if (code >= 45 && code <= 48) return '\uD83C\uDF2B\uFE0F';
  if (code >= 51 && code <= 57) return '\uD83C\uDF26\uFE0F';
  if (code >= 61 && code <= 67) return '\uD83C\uDF27\uFE0F';
  if (code >= 71 && code <= 77) return '\uD83C\uDF28\uFE0F';
  if (code >= 80 && code <= 82) return '\uD83C\uDF27\uFE0F';
  if (code >= 95) return '\u26C8\uFE0F';
  return '\u2600\uFE0F';
}

function getDayName(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();
  const dayDiff = Math.round(diff / (1000 * 60 * 60 * 24));
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Tomorrow';
  return date.toLocaleDateString('en', { weekday: 'short' });
}

export default function DestinationDetail({
  destination,
  weather,
  enrichment,
  similarDestinations,
  onPlanTrip,
  onSave,
}: DestinationDetailProps) {
  const router = useRouter();
  const place = destination.cached_place;
  const photos = place.photos?.filter(Boolean) ?? [];
  const hasPhotos = photos.length > 0;

  const currentWeatherEmoji = weather?.current?.weatherCode != null
    ? getWeatherEmoji(weather.current.weatherCode)
    : null;

  return (
    <div className="space-y-8">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--neutral-60)] hover:text-[var(--neutral-90)]"
      >
        <ArrowLeft size={18} />
        Back to Explore
      </button>

      {/* Hero Gallery */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl"
      >
        {hasPhotos && photos.length >= 3 ? (
          <div className="grid h-[400px] grid-cols-1 gap-2 md:grid-cols-3 md:grid-rows-2">
            <div className="relative col-span-1 md:col-span-2 md:row-span-2">
              <Image
                src={photos[0]}
                alt={place.city ?? ''}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 66vw"
                priority
              />
            </div>
            {photos.slice(1, 3).map((photo, i) => (
              <div key={i} className="relative hidden md:block">
                <Image
                  src={photo}
                  alt={`${place.city} ${i + 2}`}
                  fill
                  className="object-cover"
                  sizes="33vw"
                />
              </div>
            ))}
          </div>
        ) : hasPhotos ? (
          <div className="relative h-[300px] md:h-[400px]">
            <Image
              src={photos[0]}
              alt={place.city ?? ''}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>
        ) : (
          <div className="flex h-[300px] items-center justify-center bg-gradient-to-br from-[var(--primary-surface)] to-[var(--neutral-20)] md:h-[400px]">
            <MapPin size={64} weight="duotone" className="text-[var(--primary-main)] opacity-30" />
          </div>
        )}
      </motion.div>

      {/* Overview + Actions */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin size={20} weight="fill" className="text-[var(--primary-main)]" />
            <h1 className="text-2xl font-bold text-[var(--neutral-90)]">
              {place.city}, {place.country}
            </h1>
            {weather?.current?.temperature != null && currentWeatherEmoji && (
              <span className="ml-2 flex items-center gap-1 rounded-full bg-[var(--neutral-10)] px-2.5 py-1 text-sm text-[var(--neutral-70)]">
                <span>{currentWeatherEmoji}</span>
                {Math.round(weather.current.temperature)}°C
              </span>
            )}
          </div>

          {destination.tagline && (
            <p className="text-lg text-[var(--neutral-60)]">{destination.tagline}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {destination.tags.map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-3 py-1 text-xs font-medium ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-6 text-sm text-[var(--neutral-60)]">
            {place.rating && (
              <span className="flex items-center gap-1">
                <Star size={16} weight="fill" className="text-yellow-500" />
                {place.rating.toFixed(1)}
                {place.ratingCount && ` (${place.ratingCount})`}
              </span>
            )}
            {destination.avgDailyBudget && (
              <span className="flex items-center gap-1">
                <CurrencyCircleDollar size={16} />
                ~${Number(destination.avgDailyBudget)}/day
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarBlank size={16} />
              Best: {destination.bestSeasons.join(', ')}
            </span>
          </div>

          {enrichment?.bestFor && (
            <p className="text-sm italic text-[var(--primary-main)]">{enrichment.bestFor}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onSave(destination)}
            className="flex items-center gap-2 rounded-lg border border-[var(--neutral-30)] px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--neutral-10)]"
          >
            <BookmarkSimple size={18} />
            Save
          </button>
          <button
            onClick={() => onPlanTrip(destination)}
            className="flex items-center gap-2 rounded-lg bg-[var(--primary-main)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--primary-hover)]"
          >
            <PaperPlaneTilt size={18} weight="fill" />
            Plan This Trip
          </button>
        </div>
      </div>

      {/* AI Description */}
      {enrichment?.description && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <h2 className="text-xl font-bold text-[var(--neutral-90)]">About {place.city}</h2>
          <div className="whitespace-pre-line text-sm leading-relaxed text-[var(--neutral-70)]">
            {enrichment.description}
          </div>
        </motion.section>
      )}

      {/* Known For + Highlights */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {enrichment?.highlights && enrichment.highlights.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border border-[var(--neutral-30)] p-5"
          >
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--neutral-90)]">
              <Star size={18} weight="fill" className="text-yellow-500" />
              Top Highlights
            </h3>
            <ul className="space-y-2">
              {enrichment.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--neutral-70)]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-surface)] text-xs font-medium text-[var(--primary-main)]">
                    {i + 1}
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {enrichment?.localTips && enrichment.localTips.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-[var(--neutral-30)] p-5"
          >
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--neutral-90)]">
              <Lightbulb size={18} weight="fill" className="text-amber-500" />
              Local Tips
            </h3>
            <ul className="space-y-2">
              {enrichment.localTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--neutral-70)]">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {tip}
                </li>
              ))}
            </ul>
          </motion.section>
        )}
      </div>

      {/* Weather + Budget row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Weather Forecast */}
        {weather?.forecast && weather.forecast.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-[var(--neutral-30)] p-5"
          >
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--neutral-90)]">
              <ThermometerSimple size={18} weight="fill" className="text-blue-500" />
              5-Day Forecast
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {weather.forecast.slice(0, 5).map((day) => {
                const date = new Date(day.date + 'T00:00:00');
                const dayName = getDayName(day.date);
                const dateStr = date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
                const emoji = getWeatherEmoji(day.weatherCode);

                return (
                  <div
                    key={day.date}
                    className="flex flex-col items-center gap-1 rounded-xl border border-[var(--neutral-20)] bg-white px-2 py-3 shadow-sm"
                  >
                    <span className="text-xs font-semibold text-[var(--neutral-70)]">
                      {dayName}
                    </span>
                    <span className="text-[10px] text-[var(--neutral-50)]">{dateStr}</span>
                    <span className="my-1 text-2xl leading-none">{emoji}</span>
                    <span className="text-sm font-bold text-[var(--neutral-90)]">
                      {Math.round(day.tempMax)}&deg;
                    </span>
                    <span className="text-xs text-[var(--neutral-50)]">
                      {Math.round(day.tempMin)}&deg;
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Budget Breakdown */}
        {enrichment?.budgetBreakdown && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-xl border border-[var(--neutral-30)] p-5"
          >
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--neutral-90)]">
              <CurrencyCircleDollar size={18} weight="fill" className="text-green-500" />
              Budget Breakdown
            </h3>
            <div className="space-y-3">
              {[
                { icon: Bed, label: 'Accommodation', value: enrichment.budgetBreakdown.accommodation },
                { icon: ForkKnife, label: 'Food', value: enrichment.budgetBreakdown.food },
                { icon: Car, label: 'Transport', value: enrichment.budgetBreakdown.transport },
                { icon: Ticket, label: 'Activities', value: enrichment.budgetBreakdown.activities },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm text-[var(--neutral-60)]">
                    <Icon size={16} />
                    {label}
                  </span>
                  <span className="text-sm font-medium text-[var(--neutral-90)]">{value}</span>
                </div>
              ))}
            </div>
          </motion.section>
        )}
      </div>

      {/* Known For */}
      {enrichment?.knownFor && enrichment.knownFor.length > 0 && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <h3 className="mb-3 font-semibold text-[var(--neutral-90)]">Known For</h3>
          <div className="flex flex-wrap gap-2">
            {enrichment.knownFor.map((item) => (
              <span
                key={item}
                className="rounded-full border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-1.5 text-sm text-[var(--neutral-70)]"
              >
                {item}
              </span>
            ))}
          </div>
        </motion.section>
      )}

      {/* Similar Destinations */}
      {similarDestinations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--neutral-90)]">
            Similar Destinations
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {similarDestinations.map((dest, i) => (
              <ExploreDestinationCard
                key={dest.id}
                destination={dest}
                index={i}
                onPlanTrip={onPlanTrip}
                onSave={onSave}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
