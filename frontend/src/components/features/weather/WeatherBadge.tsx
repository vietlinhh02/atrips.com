'use client';

import { cn } from '@/src/lib/utils';
import type { WeatherForecast } from '@/src/services/weatherService';

const WEATHER_ICONS: Record<string, string> = {
  clear: '\u2600\uFE0F',
  'partly-cloudy': '\u26C5',
  cloudy: '\u2601\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  showers: '\uD83C\uDF27\uFE0F',
  drizzle: '\uD83C\uDF26\uFE0F',
  snow: '\uD83C\uDF28\uFE0F',
  thunderstorm: '\u26C8\uFE0F',
  fog: '\uD83C\uDF2B\uFE0F',
};

function getWeatherEmoji(icon: string): string {
  return WEATHER_ICONS[icon] ?? '\u2600\uFE0F';
}

interface WeatherBadgeProps {
  forecast: WeatherForecast;
  className?: string;
}

export default function WeatherBadge({
  forecast,
  className,
}: WeatherBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-xs font-medium leading-none',
        'bg-[var(--neutral-20)] text-[var(--neutral-70)]',
        className,
      )}
      title={`${forecast.condition}: ${Math.round(forecast.tempMin)}\u00B0C - ${Math.round(forecast.tempMax)}\u00B0C`}
    >
      <span>{getWeatherEmoji(forecast.icon)}</span>
      <span>
        {Math.round(forecast.tempMin)}&deg;-{Math.round(forecast.tempMax)}&deg;C
      </span>
    </span>
  );
}

export type { WeatherBadgeProps };
