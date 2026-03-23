'use client';

import { useEffect, useState } from 'react';
import weatherService, { type WeatherForecast } from '@/src/services/weatherService';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export default function WeatherBanner() {
  const [forecasts, setForecasts] = useState<WeatherForecast[]>([]);
  const [city, setCity] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const today = new Date();
          const end = new Date();
          end.setDate(today.getDate() + 4);

          const data = await weatherService.getForecast(
            latitude,
            longitude,
            formatDate(today),
            formatDate(end),
          );
          setForecasts(data);

          // Reverse geocode for city name
          try {
            const res = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
            );
            const geo = await res.json();
            setCity(geo.city || geo.locality || '');
          } catch {
            // City name is optional
          }
        } catch {
          // Weather fetch failed — hide section
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
      },
      { timeout: 5000 },
    );
  }, []);

  if (loading || forecasts.length === 0) return null;

  return (
    <section className="relative z-10 w-full max-w-[1320px] mx-auto px-4 md:px-6 py-8 md:py-12">
      <h3 className="text-[20px] md:text-[24px] font-medium leading-[1.2] text-[var(--neutral-100)] font-sans mb-1">
        {city ? `Weather in ${city}` : 'Local Weather'}
      </h3>
      <p className="text-[14px] text-[var(--neutral-60)] mb-5">5-day forecast for your area.</p>

      <div className="grid grid-cols-5 gap-3">
        {forecasts.map((f) => {
          const date = new Date(f.date);
          const dayName = DAY_NAMES[date.getDay()];
          const icon = WEATHER_ICONS[f.icon] ?? '\u2600\uFE0F';
          return (
            <div
              key={f.date}
              className="flex flex-col items-center gap-2 rounded-[14px] bg-white dark:bg-[var(--neutral-20)] border border-[var(--neutral-20)] dark:border-[var(--neutral-30)] py-4 px-2 shadow-sm"
              title={f.condition}
            >
              <span className="text-[13px] font-medium text-[var(--neutral-60)]">{dayName}</span>
              <span className="text-[32px] leading-none">{icon}</span>
              <div className="flex flex-col items-center">
                <span className="text-[16px] font-semibold text-[var(--neutral-100)]">
                  {Math.round(f.tempMax)}&deg;C
                </span>
                <span className="text-[13px] text-[var(--neutral-50)]">
                  {Math.round(f.tempMin)}&deg;C
                </span>
              </div>
              <span className="text-[11px] text-[var(--neutral-50)] capitalize">{f.condition}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
