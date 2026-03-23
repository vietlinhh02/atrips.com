'use client';

import { Sun, Cloud, CloudRain, Snowflake } from '@phosphor-icons/react';

interface WeatherBadgeProps {
  temperature?: number;
  condition?: string;
}

const WEATHER_ICONS: Record<string, typeof Sun> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: Snowflake,
};

export default function WeatherBadge({
  temperature,
  condition = 'sunny',
}: WeatherBadgeProps) {
  if (temperature === undefined) return null;

  const Icon = WEATHER_ICONS[condition] ?? Sun;

  return (
    <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-xs text-white backdrop-blur-sm">
      <Icon size={14} weight="fill" />
      <span>{temperature}&deg;</span>
    </div>
  );
}
