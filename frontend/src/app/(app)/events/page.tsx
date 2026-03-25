'use client';

import {
  CalendarBlank,
  MusicNotes,
  Confetti,
  MapPin,
} from '@phosphor-icons/react';
import ComingSoon from '@/src/components/features/common/ComingSoon';

export default function EventsPage() {
  return (
    <ComingSoon
      icon={<CalendarBlank size={20} weight="fill" />}
      title="Local Events"
      subtitle="Discover festivals, concerts, and cultural events at your destination"
      bannerHeading="Never miss a local experience"
      bannerDescription="Find the best events happening wherever you travel — from street food festivals to music concerts, cultural celebrations, and hidden local gatherings."
      features={[
        {
          icon: <MusicNotes size={24} weight="duotone" />,
          title: 'Live Events',
          description: 'Concerts, festivals, and performances near your destination',
          accentColor: 'text-pink-500',
          bgColor: 'bg-pink-50 dark:bg-pink-950/40',
        },
        {
          icon: <Confetti size={24} weight="duotone" />,
          title: 'Local Festivals',
          description: 'Discover traditional celebrations and cultural events',
          accentColor: 'text-orange-500',
          bgColor: 'bg-orange-50 dark:bg-orange-950/40',
        },
        {
          icon: <MapPin size={24} weight="duotone" />,
          title: 'Nearby Events',
          description: 'Find events based on your itinerary dates and location',
          accentColor: 'text-cyan-500',
          bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
        },
      ]}
      previewCards={[
        { title: 'Tết Nguyên Đán Festival', subtitle: 'Feb 2026 · Cultural', imageUrl: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=600&q=80', location: 'Ho Chi Minh City' },
        { title: 'Songkran Water Festival', subtitle: 'Apr 2026 · Festival', imageUrl: 'https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=600&q=80', location: 'Chiang Mai, Thailand' },
        { title: 'Bali Arts Festival', subtitle: 'Jun 2026 · Arts', imageUrl: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=600&q=80', location: 'Denpasar, Bali' },
        { title: 'Hanoi Food Festival', subtitle: 'Mar 2026 · Food', imageUrl: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&q=80', location: 'Hanoi, Vietnam' },
      ]}
    />
  );
}
