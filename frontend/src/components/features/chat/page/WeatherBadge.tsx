'use client';

import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSun,
  CloudSnow,
  Warning,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

import { cn } from '@/src/lib/utils';

interface WeatherBadgeProps {
  condition: string;
  tempHigh: number;
  tempLow: number;
  isOutdoorActivity?: boolean;
  className?: string;
}

const OUTDOOR_ACTIVITY_TYPES = new Set([
  'attraction',
  'activity',
  'sightseeing',
  'hiking',
  'beach',
  'outdoor',
  'park',
  'nature',
  'adventure',
  'tour',
  'walking',
  'cycling',
  'water_sport',
  'sports',
]);

type WeatherConfig = {
  icon: Icon;
  label: string;
  colorClass: string;
  isRainy: boolean;
};

function resolveWeatherConfig(condition: string): WeatherConfig {
  const normalized = condition.toLowerCase().trim();

  if (normalized.includes('storm') || normalized.includes('thunder')) {
    return {
      icon: CloudLightning,
      label: 'Stormy',
      colorClass: 'text-purple-500',
      isRainy: true,
    };
  }
  if (normalized.includes('snow') || normalized.includes('blizzard')) {
    return {
      icon: CloudSnow,
      label: 'Snowy',
      colorClass: 'text-sky-400',
      isRainy: false,
    };
  }
  if (
    normalized.includes('rain') ||
    normalized.includes('drizzle') ||
    normalized.includes('shower')
  ) {
    return {
      icon: CloudRain,
      label: 'Rainy',
      colorClass: 'text-blue-500',
      isRainy: true,
    };
  }
  if (
    normalized.includes('partly') ||
    normalized.includes('partial') ||
    normalized.includes('mostly sunny')
  ) {
    return {
      icon: CloudSun,
      label: 'Partly Cloudy',
      colorClass: 'text-amber-400',
      isRainy: false,
    };
  }
  if (
    normalized.includes('cloud') ||
    normalized.includes('overcast') ||
    normalized.includes('foggy') ||
    normalized.includes('fog') ||
    normalized.includes('mist')
  ) {
    return {
      icon: Cloud,
      label: 'Cloudy',
      colorClass: 'text-gray-400',
      isRainy: false,
    };
  }

  return {
    icon: Sun,
    label: 'Sunny',
    colorClass: 'text-amber-400',
    isRainy: false,
  };
}

function isOutdoorType(activityType?: string): boolean {
  if (!activityType) return false;
  return OUTDOOR_ACTIVITY_TYPES.has(activityType.toLowerCase().trim());
}

export default function WeatherBadge({
  condition,
  tempHigh,
  tempLow,
  isOutdoorActivity,
  className,
}: WeatherBadgeProps) {
  const config = resolveWeatherConfig(condition);
  const IconComponent = config.icon;
  const showWarning = config.isRainy && isOutdoorActivity;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-[11px] font-medium leading-none',
        'bg-[var(--neutral-20)] text-[var(--neutral-70)]',
        showWarning && 'bg-amber-50 text-amber-700',
        className,
      )}
      title={`${config.label}: ${tempHigh}°C / ${tempLow}°C`}
    >
      <IconComponent
        size={13}
        weight="fill"
        className={cn(config.colorClass)}
      />
      <span>{tempHigh}°</span>
      <span className="text-[var(--neutral-50)]">/</span>
      <span className="text-[var(--neutral-50)]">{tempLow}°</span>
      {showWarning && (
        <Warning size={11} weight="fill" className="text-amber-500 ml-0.5" />
      )}
    </span>
  );
}

export { isOutdoorType, resolveWeatherConfig, OUTDOOR_ACTIVITY_TYPES };
export type { WeatherBadgeProps };
