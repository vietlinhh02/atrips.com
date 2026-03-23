'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO } from 'date-fns';

import { cn } from '@/src/lib/utils';
import {
  weatherService,
  type WeatherForecast,
  type CityWeather,
} from '@/src/services/weatherService';

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

interface WeatherWidgetProps {
  tripId?: string;
  latitude?: number;
  longitude?: number;
  startDate?: string;
  endDate?: string;
  className?: string;
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; forecasts: WeatherForecast[]; cities?: CityWeather[] };

function ForecastCard({ forecast }: { forecast: WeatherForecast }) {
  const date = parseISO(forecast.date);
  const dayName = format(date, 'EEE');
  const dateStr = format(date, 'MMM d');
  const hasPrecipitation =
    forecast.precipitation !== null && forecast.precipitation > 0;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl px-3 py-3',
        'bg-white shadow-sm border border-[var(--neutral-20)]',
        'min-w-[80px] shrink-0',
      )}
    >
      <span className="text-xs font-semibold text-[var(--neutral-70)]">
        {dayName}
      </span>
      <span className="text-[10px] text-[var(--neutral-50)]">{dateStr}</span>
      <span className="text-2xl leading-none my-1">
        {getWeatherEmoji(forecast.icon)}
      </span>
      <span className="text-sm font-bold text-[var(--neutral-90)]">
        {Math.round(forecast.tempMax)}&deg;
      </span>
      <span className="text-xs text-[var(--neutral-50)]">
        {Math.round(forecast.tempMin)}&deg;
      </span>
      {hasPrecipitation && (
        <span className="text-[10px] text-blue-500 mt-0.5">
          {forecast.precipitation}mm
        </span>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex flex-col items-center gap-2 rounded-xl px-3 py-3',
            'bg-[var(--neutral-10)] min-w-[80px] shrink-0 animate-pulse',
          )}
        >
          <div className="h-3 w-8 rounded bg-[var(--neutral-20)]" />
          <div className="h-2 w-10 rounded bg-[var(--neutral-20)]" />
          <div className="h-6 w-6 rounded-full bg-[var(--neutral-20)]" />
          <div className="h-3 w-6 rounded bg-[var(--neutral-20)]" />
          <div className="h-2 w-5 rounded bg-[var(--neutral-20)]" />
        </div>
      ))}
    </div>
  );
}

export default function WeatherWidget({
  tripId,
  latitude,
  longitude,
  startDate,
  endDate,
  className,
}: WeatherWidgetProps) {
  const [state, setState] = useState<FetchState>({ status: 'idle' });

  const fetchWeather = useCallback(async () => {
    setState({ status: 'loading' });

    try {
      if (tripId) {
        const cities = await weatherService.getTripWeather(tripId);
        const allForecasts = cities.flatMap((c) => c.forecasts);
        setState({ status: 'success', forecasts: allForecasts, cities });
        return;
      }

      if (
        latitude !== undefined &&
        longitude !== undefined &&
        startDate &&
        endDate
      ) {
        const forecasts = await weatherService.getForecast(
          latitude,
          longitude,
          startDate,
          endDate,
        );
        setState({ status: 'success', forecasts });
        return;
      }

      setState({ status: 'error' });
    } catch {
      setState({ status: 'error' });
    }
  }, [tripId, latitude, longitude, startDate, endDate]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div className={cn('w-full', className)}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        className={cn(
          'rounded-xl border border-[var(--neutral-20)] px-4 py-3',
          'text-sm text-[var(--neutral-50)]',
          className,
        )}
      >
        Weather unavailable
      </div>
    );
  }

  if (state.forecasts.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-[var(--neutral-20)] px-4 py-3',
          'text-sm text-[var(--neutral-50)]',
          className,
        )}
      >
        No forecast data available
      </div>
    );
  }

  if (state.cities && state.cities.length > 1) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {state.cities.map((city) => (
          <div key={city.city}>
            <span className="text-xs font-semibold text-[var(--neutral-60)] mb-1 block">
              {city.city}
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {city.forecasts.map((f) => (
                <ForecastCard key={f.date} forecast={f} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {state.forecasts.map((f) => (
          <ForecastCard key={f.date} forecast={f} />
        ))}
      </div>
    </div>
  );
}
